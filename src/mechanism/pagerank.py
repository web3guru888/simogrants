"""
PageRank engine for dependency-weighted funding in SQF.

Projects that are widely depended upon (e.g., OpenZeppelin) receive a PageRank
boost to their funding allocation. Documentation-only repos and low-signal
repos are filtered out to prevent inflation.
"""
from __future__ import annotations

import networkx as nx
import numpy as np

from src.mechanism.dependency_graph import is_docs_repo, is_low_signal_repo


class PageRankEngine:
    def __init__(self, damping: float = 0.85):
        self.damping = damping
        self.graph = nx.DiGraph()

    def build_graph(self, dependencies: list[tuple[str, str]]):
        """
        Build directed graph from (dependent, dependency) edges.

        Edges point FROM the dependent TO the dependency, so PageRank
        flows to heavily-depended-upon projects.
        """
        self.graph = nx.DiGraph()
        for dependent, dependency in dependencies:
            if dependent and dependency and dependent != dependency:
                self.graph.add_edge(dependent, dependency)

    def validate_dependency(
        self,
        repo_name: str,
        stars: int = 0,
        forks: int = 0,
        full_name: str = "",
        min_stars: int = 10,
        min_forks: int = 5,
    ) -> bool:
        """
        Validate whether a repo should be included in the dependency graph.

        Filters out:
        - Documentation-only repos (path contains docs, documentation, .github, wiki, etc.)
        - Repos with < min_stars stars AND < min_forks forks (not real dependencies)

        Args:
            repo_name: Repository name (e.g., "docs", "contracts")
            stars: GitHub star count
            forks: GitHub fork count
            full_name: Full repo path (e.g., "protocolguild/docs")
            min_stars: Minimum star threshold
            min_forks: Minimum fork threshold

        Returns:
            True if the repo is valid for dependency analysis
        """
        if is_docs_repo(repo_name, full_name):
            return False
        if is_low_signal_repo(stars, forks, min_stars, min_forks):
            return False
        return True

    def compute_pagerank(self) -> dict[str, float]:
        """Compute PageRank scores for all nodes in the dependency graph."""
        if len(self.graph) == 0:
            return {}
        return nx.pagerank(self.graph, alpha=self.damping)

    def get_modifier(self, project_id: str, pagerank_scores: dict[str, float]) -> float:
        """
        Convert a project's PageRank score into a funding modifier.

        Projects with above-average PageRank (i.e., many dependents) get a
        boost up to 1.8x. Projects with below-average PageRank get reduced
        down to 0.5x. Projects not in the graph get a neutral 1.0.

        The modifier range [0.5, 1.8] is wider than before to ensure that
        dependency relationships meaningfully affect funding allocation.
        """
        if not pagerank_scores or project_id not in pagerank_scores:
            return 1.0

        score = pagerank_scores[project_id]
        mean_score = float(np.mean(list(pagerank_scores.values())))

        if mean_score <= 0:
            return 1.0

        # ratio > 1 means above-average PageRank (important dependency)
        # ratio < 1 means below-average PageRank (leaf/consumer project)
        ratio = score / mean_score

        # Linear mapping: ratio 0 → 0.5, ratio 1 → 1.0, ratio 3+ → 1.8
        # This gives a meaningful spread between infra and consumer projects
        modifier = 0.5 + 0.5 * min(ratio / 1.0, 1.0) + 0.3 * max(0, min((ratio - 1.0) / 2.0, 1.0))

        return max(0.5, min(1.8, modifier))
