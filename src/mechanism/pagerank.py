from __future__ import annotations

import networkx as nx
import numpy as np


class PageRankEngine:
    def __init__(self, damping: float = 0.85):
        self.damping = damping
        self.graph = nx.DiGraph()

    def build_graph(self, dependencies: list[tuple[str, str]]):
        self.graph = nx.DiGraph()
        for dependent, dependency in dependencies:
            if dependent and dependency:
                self.graph.add_edge(dependent, dependency)

    def compute_pagerank(self) -> dict[str, float]:
        if len(self.graph) == 0:
            return {}
        return nx.pagerank(self.graph, alpha=self.damping)

    def get_modifier(self, project_id: str, pagerank_scores: dict[str, float]) -> float:
        if project_id not in pagerank_scores or not pagerank_scores:
            return 1.0
        score = pagerank_scores[project_id]
        mean_score = float(np.mean(list(pagerank_scores.values())))
        if mean_score <= 0:
            return 1.0
        ratio = score / mean_score
        modifier = 0.8 + 0.6 * min(ratio / 3.0, 1.0)
        return max(0.8, min(1.4, modifier))
