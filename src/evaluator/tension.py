"""
SIMOGRANTS Evaluator — Tension Detection

Identifies significant disagreements between stakeholder agents on
shared or comparable dimensions. A tension is flagged when the spread
(max - min) across agents exceeds a configurable threshold (default 35).
"""
from __future__ import annotations

import logging
from typing import Optional

from .models import (
    DimensionScore,
    Tension,
    StakeholderEvaluation,
    STAKEHOLDER_DIMENSIONS,
    DIMENSION_LABELS,
)

logger = logging.getLogger(__name__)

# Default spread threshold for flagging a tension
DEFAULT_THRESHOLD: int = 35


def detect_tensions(
    evaluations: list[StakeholderEvaluation],
    threshold: int = DEFAULT_THRESHOLD,
) -> list[Tension]:
    """
    Find dimensions where stakeholder spread exceeds the threshold.

    Since each stakeholder agent scores DIFFERENT dimensions (e.g., developer
    scores code_quality while user scores adoption_metrics), direct cross-
    stakeholder comparison is done on a per-dimension basis for the
    *composite / mapped* dimensions AND across agent mean scores.

    We also detect meta-tensions: when one agent's overall mean score
    diverges significantly from the group mean.

    Args:
        evaluations: List of StakeholderEvaluations from different agents.
        threshold: Minimum spread (max - min) to flag a tension.

    Returns:
        List of Tension objects, sorted by spread (highest first).
    """
    if len(evaluations) < 2:
        logger.debug("Need >= 2 evaluations for tension detection, got %d", len(evaluations))
        return []

    tensions: list[Tension] = []

    # -------------------------------------------------------------------
    # 1. Collect all scores per dimension across agents
    # -------------------------------------------------------------------
    dimension_agent_scores: dict[str, dict[str, int]] = {}
    for ev in evaluations:
        for dim_name, dim_score in ev.scores.items():
            if dim_name not in dimension_agent_scores:
                dimension_agent_scores[dim_name] = {}
            dimension_agent_scores[dim_name][ev.agent_type] = dim_score.score

    # -------------------------------------------------------------------
    # 2. Check each dimension for cross-agent tensions
    #    (Only applies if multiple agents score the same dimension)
    # -------------------------------------------------------------------
    for dim_name, agent_scores in dimension_agent_scores.items():
        if len(agent_scores) < 2:
            continue  # Only one agent scores this dimension

        tension = _check_spread(dim_name, agent_scores, threshold)
        if tension is not None:
            tensions.append(tension)

    # -------------------------------------------------------------------
    # 3. Meta-tension: compare agent mean scores across stakeholders
    # -------------------------------------------------------------------
    agent_means: dict[str, int] = {}
    for ev in evaluations:
        agent_means[ev.agent_type] = round(ev.mean_score)

    if len(agent_means) >= 2:
        meta_tension = _check_spread("overall_mean", agent_means, threshold)
        if meta_tension is not None:
            meta_tension.narrative = _generate_meta_narrative(
                meta_tension, evaluations
            )
            tensions.append(meta_tension)

    # -------------------------------------------------------------------
    # 4. Cross-category tension detection
    #    Map each agent's dimensions to a normalized "quality" bucket and
    #    compare across agents even though dimensions differ.
    # -------------------------------------------------------------------
    cross_tensions = _detect_cross_category_tensions(evaluations, threshold)
    tensions.extend(cross_tensions)

    # Sort by spread (highest first)
    tensions.sort(key=lambda t: t.spread, reverse=True)

    logger.info(
        "Detected %d tensions (threshold=%d) for project %s",
        len(tensions),
        threshold,
        evaluations[0].project_id if evaluations else "unknown",
    )

    return tensions


def _check_spread(
    dimension: str,
    agent_scores: dict[str, int],
    threshold: int,
) -> Optional[Tension]:
    """Check if the spread for a dimension exceeds threshold."""
    if len(agent_scores) < 2:
        return None

    scores = agent_scores
    max_agent = max(scores, key=scores.get)  # type: ignore[arg-type]
    min_agent = min(scores, key=scores.get)  # type: ignore[arg-type]
    spread = scores[max_agent] - scores[min_agent]

    if spread >= threshold:
        label = DIMENSION_LABELS.get(dimension, dimension.replace("_", " ").title())
        narrative = (
            f"Significant disagreement on {label}: "
            f"{max_agent} scored {scores[max_agent]} while "
            f"{min_agent} scored {scores[min_agent]} "
            f"(spread: {spread} points)."
        )
        return Tension(
            dimension=dimension,
            agents=dict(scores),
            spread=spread,
            high_agent=max_agent,
            low_agent=min_agent,
            narrative=narrative,
        )

    return None


def _generate_meta_narrative(
    tension: Tension,
    evaluations: list[StakeholderEvaluation],
) -> str:
    """Generate narrative for meta-level (overall mean) tensions."""
    high = tension.high_agent
    low = tension.low_agent

    high_top_dim = ""
    low_top_dim = ""
    for ev in evaluations:
        if ev.agent_type == high and ev.scores:
            best = max(ev.scores.items(), key=lambda x: x[1].score)
            high_top_dim = f" (strongest: {DIMENSION_LABELS.get(best[0], best[0])} at {best[1].score})"
        if ev.agent_type == low and ev.scores:
            worst = min(ev.scores.items(), key=lambda x: x[1].score)
            low_top_dim = f" (weakest: {DIMENSION_LABELS.get(worst[0], worst[0])} at {worst[1].score})"

    return (
        f"The {high} agent is significantly more positive (mean: {tension.agents[high]}){high_top_dim} "
        f"than the {low} agent (mean: {tension.agents[low]}){low_top_dim}. "
        f"This {tension.spread}-point gap suggests the project's strengths are unevenly "
        f"distributed across stakeholder concerns."
    )


def _detect_cross_category_tensions(
    evaluations: list[StakeholderEvaluation],
    threshold: int,
) -> list[Tension]:
    """
    Detect tensions across different dimension categories.

    Compares agent-level aggregates: each agent's mean score across their
    own 3 dimensions. This catches cases where, e.g., the developer agent
    thinks the project is great (high code quality) but the funder agent
    is skeptical (low capital efficiency).
    """
    tensions: list[Tension] = []

    # Compare each pair of agents' mean scores
    agent_data: dict[str, tuple[float, StakeholderEvaluation]] = {}
    for ev in evaluations:
        agent_data[ev.agent_type] = (ev.mean_score, ev)

    agents = sorted(agent_data.keys())
    for i, a in enumerate(agents):
        for b in agents[i + 1:]:
            mean_a = agent_data[a][0]
            mean_b = agent_data[b][0]
            spread = abs(mean_a - mean_b)

            if spread >= threshold:
                high = a if mean_a > mean_b else b
                low = b if mean_a > mean_b else a
                high_mean = max(mean_a, mean_b)
                low_mean = min(mean_a, mean_b)

                tensions.append(Tension(
                    dimension=f"{high}_vs_{low}",
                    agents={high: round(high_mean), low: round(low_mean)},
                    spread=round(spread),
                    high_agent=high,
                    low_agent=low,
                    narrative=(
                        f"Cross-stakeholder tension: {high} (mean {high_mean:.0f}) "
                        f"is {spread:.0f} points above {low} (mean {low_mean:.0f}). "
                        f"The project resonates much more strongly with {high} concerns "
                        f"than {low} priorities."
                    ),
                ))

    return tensions


def summarize_tensions(tensions: list[Tension]) -> str:
    """Generate a human-readable summary of all detected tensions."""
    if not tensions:
        return "No significant tensions detected. Stakeholder agents are broadly aligned."

    lines = [f"## Detected Tensions ({len(tensions)})\n"]

    for i, t in enumerate(tensions, 1):
        lines.append(f"**{i}. {t.dimension}** (spread: {t.spread})")
        lines.append(f"   {t.narrative}")
        lines.append("")

    return "\n".join(lines)
