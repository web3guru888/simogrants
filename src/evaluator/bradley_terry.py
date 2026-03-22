"""
SIMOGRANTS Evaluator — Bradley-Terry Pairwise Comparison

Maximum Likelihood Estimation for Bradley-Terry model using
scipy.optimize.minimize (L-BFGS-B). Converts pairwise comparison
outcomes into strength parameters for ranking projects.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from scipy.optimize import minimize

logger = logging.getLogger(__name__)


def bradley_terry_aggregate(
    comparisons: list[tuple[str, str, float]],
    max_iter: int = 1000,
    tol: float = 1e-8,
) -> dict[str, float]:
    """
    Compute Bradley-Terry strength parameters from pairwise comparisons.

    Args:
        comparisons: List of (project_a, project_b, p_a_wins) tuples where
                     p_a_wins is the probability that project_a beats project_b
                     (0.0 to 1.0). Values are typically derived from score
                     comparisons across stakeholders.
        max_iter: Maximum iterations for the optimizer.
        tol: Convergence tolerance.

    Returns:
        Dictionary mapping project_id -> strength parameter (higher = better).
        Strengths are normalized so the mean is 0 (in log-space).

    Raises:
        ValueError: If comparisons list is empty or contains invalid data.
    """
    if not comparisons:
        raise ValueError("Cannot compute BT rankings from empty comparisons list")

    # -----------------------------------------------------------------------
    # 1. Build index of projects
    # -----------------------------------------------------------------------
    projects: set[str] = set()
    for a, b, p in comparisons:
        projects.add(a)
        projects.add(b)

    project_list = sorted(projects)
    n = len(project_list)
    idx = {p: i for i, p in enumerate(project_list)}

    if n < 2:
        # Only one project — return default strength
        return {project_list[0]: 1.0}

    logger.info("Bradley-Terry: %d projects, %d comparisons", n, len(comparisons))

    # -----------------------------------------------------------------------
    # 2. Validate and preprocess comparisons
    # -----------------------------------------------------------------------
    processed: list[tuple[int, int, float]] = []
    for a, b, p in comparisons:
        if not (0.0 <= p <= 1.0):
            raise ValueError(f"p_a_wins must be in [0, 1], got {p} for ({a}, {b})")
        # Clamp extreme values to avoid log(0)
        p_clamped = np.clip(p, 0.001, 0.999)
        processed.append((idx[a], idx[b], p_clamped))

    # -----------------------------------------------------------------------
    # 3. Negative log-likelihood function
    # -----------------------------------------------------------------------
    def neg_log_likelihood(params: np.ndarray) -> float:
        """
        BT negative log-likelihood.

        P(a beats b) = exp(theta_a) / (exp(theta_a) + exp(theta_b))
                      = sigmoid(theta_a - theta_b)

        For fractional outcomes (p_a_wins is a probability), we use:
        L = sum[ p_ab * log(sigma(a-b)) + (1-p_ab) * log(sigma(b-a)) ]
        """
        nll = 0.0
        for i_a, i_b, p_ab in processed:
            diff = params[i_a] - params[i_b]
            # Use numerically stable log-sigmoid
            # log(sigmoid(x)) = -log(1 + exp(-x)) = -softplus(-x)
            log_sig_pos = -_softplus(-diff)
            log_sig_neg = -_softplus(diff)
            nll -= p_ab * log_sig_pos + (1.0 - p_ab) * log_sig_neg
        return nll

    def neg_log_likelihood_grad(params: np.ndarray) -> np.ndarray:
        """Gradient of the negative log-likelihood."""
        grad = np.zeros(n)
        for i_a, i_b, p_ab in processed:
            diff = params[i_a] - params[i_b]
            sig = _sigmoid(diff)
            # d/d(theta_a) = -(p_ab - sigmoid(diff))
            # d/d(theta_b) = (p_ab - sigmoid(diff))
            residual = p_ab - sig
            grad[i_a] -= residual
            grad[i_b] += residual
        return grad

    # -----------------------------------------------------------------------
    # 4. Optimize
    # -----------------------------------------------------------------------
    x0 = np.zeros(n)
    result = minimize(
        neg_log_likelihood,
        x0,
        jac=neg_log_likelihood_grad,
        method="L-BFGS-B",
        options={"maxiter": max_iter, "ftol": tol},
    )

    if not result.success:
        logger.warning("BT optimization did not converge: %s", result.message)

    # -----------------------------------------------------------------------
    # 5. Normalize (mean-center) and return
    # -----------------------------------------------------------------------
    strengths = result.x
    strengths -= strengths.mean()  # center at 0

    rankings = {
        project_list[i]: float(round(strengths[i], 6))
        for i in range(n)
    }

    logger.info("BT rankings: %s", rankings)
    return rankings


def generate_pairwise_comparisons(
    project_scores: dict[str, float],
    steepness: float = 0.1,
) -> list[tuple[str, str, float]]:
    """
    Generate pairwise comparison probabilities from aggregate scores.

    This converts each project's overall score into BT-compatible pairwise
    comparisons using a logistic function:
        P(a > b) = sigmoid(steepness * (score_a - score_b))

    Args:
        project_scores: {project_id: overall_score} mapping.
        steepness: Controls how sharply score differences map to win
                   probabilities. Higher = more decisive.

    Returns:
        List of (project_a, project_b, p_a_wins) tuples for all pairs.
    """
    projects = sorted(project_scores.keys())
    comparisons: list[tuple[str, str, float]] = []

    for i, a in enumerate(projects):
        for b in projects[i + 1:]:
            diff = project_scores[a] - project_scores[b]
            p_a_wins = float(_sigmoid(steepness * diff))
            comparisons.append((a, b, p_a_wins))

    return comparisons


def bt_rank_to_percentile(
    rankings: dict[str, float],
    project_id: str,
) -> Optional[float]:
    """
    Convert a BT rank to a rough percentile (0-100).

    Uses the CDF of the normal distribution fitted to the rank distribution.
    """
    if project_id not in rankings:
        return None
    if len(rankings) < 2:
        return 50.0

    values = np.array(list(rankings.values()))
    mean = values.mean()
    std = values.std()
    if std < 1e-10:
        return 50.0

    from scipy.stats import norm
    percentile = norm.cdf(rankings[project_id], loc=mean, scale=std) * 100
    return float(round(percentile, 2))


# ---------------------------------------------------------------------------
# Numerical helpers
# ---------------------------------------------------------------------------

def _sigmoid(x: float) -> float:
    """Numerically stable sigmoid."""
    if x >= 0:
        z = np.exp(-x)
        return 1.0 / (1.0 + z)
    else:
        z = np.exp(x)
        return z / (1.0 + z)


def _softplus(x: float) -> float:
    """Numerically stable softplus: log(1 + exp(x))."""
    if x > 20:
        return x
    elif x < -20:
        return 0.0
    else:
        return float(np.log1p(np.exp(x)))
