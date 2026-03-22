"""
Stigmergic Quadratic Funding (SQF) mechanism.

Combines:
1. Quadratic Funding — amplifies breadth of community support
2. PageRank on dependency graph — boosts infra projects that others depend on
3. Pheromone trails — rewards projects with consistent historical accuracy

The key fix: contributions are generated with a FIXED number of virtual
contributors per project, with contribution SIZE proportional to score.
This prevents the old bug where higher-scoring projects got both more
contributors AND larger contributions, creating super-linear amplification.
"""
from __future__ import annotations

import math

from src.mechanism.qf import QFEngine
from src.mechanism.pheromone import PheromoneTracker
from src.mechanism.pagerank import PageRankEngine
from src.mechanism.dependency_graph import (
    build_dependency_edges,
    build_dependency_edges_from_known,
    ProjectRepos,
)


# Fixed number of virtual contributors per project for QF calculation
DEFAULT_VIRTUAL_CONTRIBUTORS = 10


def scores_to_contributions(
    evaluation_scores: dict[str, float],
    num_contributors: int = DEFAULT_VIRTUAL_CONTRIBUTORS,
) -> dict[str, list[float]]:
    """
    Convert evaluation scores to QF contribution lists.

    Each project gets the SAME number of virtual contributors.
    The contribution SIZE is proportional to the score.
    This ensures QF reflects quality (via contribution size) and
    community support (same breadth for all), without the old bug
    where higher scores got exponentially more virtual contributors.

    Args:
        evaluation_scores: Map of project_id → overall score (0-100)
        num_contributors: Fixed number of virtual contributors per project

    Returns:
        Map of project_id → list of contribution amounts
    """
    contributions: dict[str, list[float]] = {}
    for pid, score in evaluation_scores.items():
        # Contribution size proportional to score, scaled to reasonable range
        contribution_size = max(0.01, score / 10.0)
        contributions[pid] = [contribution_size] * num_contributors
    return contributions


class SQFMechanism:
    def __init__(self, matching_pool: float = 100000, damping: float = 0.85, cap: float = 0.25):
        self.qf = QFEngine(cap_per_project=cap)
        self.pheromone = PheromoneTracker()
        self.pagerank = PageRankEngine(damping=damping)
        self.matching_pool = matching_pool

    def compute_allocation(
        self,
        contributions: dict[str, list[float]],
        dependencies: list[tuple[str, str]],
        evaluation_scores: dict[str, float] | None = None,
    ) -> dict[str, float]:
        """
        Compute SQF funding allocation.

        Args:
            contributions: Map of project_id → list of contribution amounts.
                          Use scores_to_contributions() to generate these properly.
            dependencies: List of (dependent, dependency) edges for PageRank.
                         Use build_dependency_edges() or build_dependency_edges_from_known().
            evaluation_scores: Optional raw scores for tiebreaking/logging.

        Returns:
            Map of project_id → allocated funding amount
        """
        if not contributions:
            return {}

        # Step 1: Base QF allocation
        qf_alloc = self.qf.calculate(contributions, self.matching_pool)

        # Step 2: PageRank modifier from dependency graph
        self.pagerank.build_graph(dependencies)
        pr_scores = self.pagerank.compute_pagerank()

        # Step 3: Apply modifiers (PageRank + Pheromone)
        sqf_alloc: dict[str, float] = {}
        for project, base in qf_alloc.items():
            pheromone_mod = self.pheromone.get_modifier(project)
            pagerank_mod = self.pagerank.get_modifier(project, pr_scores)
            sqf_alloc[project] = base * pheromone_mod * pagerank_mod

        # Normalize to match the pool
        total = sum(sqf_alloc.values())
        if total <= 0:
            equal = self.matching_pool / len(contributions)
            return {p: equal for p in contributions}
        return {p: (v / total) * self.matching_pool for p, v in sqf_alloc.items()}

    def compute_allocation_from_scores(
        self,
        evaluation_scores: dict[str, float],
        dependencies: list[tuple[str, str]],
        num_contributors: int = DEFAULT_VIRTUAL_CONTRIBUTORS,
    ) -> dict[str, float]:
        """
        Convenience method: compute allocation directly from evaluation scores.

        This is the recommended entry point for the pipeline. It properly
        converts scores to contributions with fixed contributor count.

        Args:
            evaluation_scores: Map of project_id → overall score (0-100)
            dependencies: List of (dependent, dependency) edges
            num_contributors: Virtual contributors per project (default 10)

        Returns:
            Map of project_id → allocated funding amount
        """
        contributions = scores_to_contributions(evaluation_scores, num_contributors)
        return self.compute_allocation(contributions, dependencies, evaluation_scores)

    def advance_epoch(self, accuracy_scores: dict[str, float]):
        self.pheromone.decay_all()
        for project, accuracy in accuracy_scores.items():
            self.pheromone.deposit(project, accuracy)

    def get_state(self) -> dict:
        return {
            "matching_pool": self.matching_pool,
            "pheromone_state": self.pheromone.get_state(),
            "pagerank_nodes": list(self.pagerank.graph.nodes()),
        }
