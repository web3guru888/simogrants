from __future__ import annotations

from src.mechanism.qf import QFEngine
from src.mechanism.pheromone import PheromoneTracker
from src.mechanism.pagerank import PageRankEngine


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
        if not contributions:
            return {}
        qf_alloc = self.qf.calculate(contributions, self.matching_pool)
        self.pagerank.build_graph(dependencies)
        pr_scores = self.pagerank.compute_pagerank()

        sqf_alloc: dict[str, float] = {}
        for project, base in qf_alloc.items():
            pheromone_mod = self.pheromone.get_modifier(project)
            pagerank_mod = self.pagerank.get_modifier(project, pr_scores)
            sqf_alloc[project] = base * pheromone_mod * pagerank_mod

        total = sum(sqf_alloc.values())
        if total <= 0:
            equal = self.matching_pool / len(contributions)
            return {p: equal for p in contributions}
        return {p: (v / total) * self.matching_pool for p, v in sqf_alloc.items()}

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
