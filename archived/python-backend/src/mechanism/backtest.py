from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from src.mechanism.sqf import SQFMechanism


@dataclass
class BacktestResult:
    epochs: list[dict]
    summary: dict


class BacktestingEngine:
    def run_backtest(self, historical_data: list[dict], config: dict) -> BacktestResult:
        mechanism = SQFMechanism(
            matching_pool=config.get('matching_pool', 100000),
            damping=config.get('damping', 0.85),
            cap=config.get('cap', 0.25),
        )
        results = []
        correlations = []
        for epoch_idx, epoch_data in enumerate(historical_data):
            alloc = mechanism.compute_allocation(
                epoch_data['contributions'],
                epoch_data.get('dependencies', []),
                epoch_data.get('evaluation_scores', {}),
            )
            accuracy_scores = {}
            if 'actual_impact' in epoch_data:
                actual = epoch_data['actual_impact']
                accuracy_scores = self._compute_accuracy(alloc, actual)
                correlations.append(self._spearman_like(alloc, actual))
                mechanism.advance_epoch(accuracy_scores)
            results.append({
                'epoch': epoch_idx,
                'allocations': alloc,
                'pheromone_state': dict(mechanism.pheromone.pheromones),
                'accuracy_scores': accuracy_scores,
            })
        return BacktestResult(
            epochs=results,
            summary={
                'epochs_run': len(results),
                'avg_rank_correlation': float(np.mean(correlations)) if correlations else 0.0,
            },
        )

    def _compute_accuracy(self, alloc: dict[str, float], actual: dict[str, float]) -> dict[str, float]:
        out = {}
        max_actual = max(actual.values()) if actual else 1.0
        for project, amount in alloc.items():
            expected = actual.get(project, 0.0) / max_actual if max_actual > 0 else 0.0
            alloc_norm = amount / max(alloc.values()) if alloc and max(alloc.values()) > 0 else 0.0
            out[project] = max(0.0, 1.0 - abs(alloc_norm - expected))
        return out

    def _spearman_like(self, alloc: dict[str, float], actual: dict[str, float]) -> float:
        projects = [p for p in alloc if p in actual]
        if len(projects) < 2:
            return 0.0
        a = np.array([alloc[p] for p in projects], dtype=float)
        b = np.array([actual[p] for p in projects], dtype=float)
        a_rank = a.argsort().argsort()
        b_rank = b.argsort().argsort()
        if np.std(a_rank) == 0 or np.std(b_rank) == 0:
            return 0.0
        return float(np.corrcoef(a_rank, b_rank)[0, 1])

    def generate_synthetic_data(self, n_projects: int = 10, n_epochs: int = 5) -> list[dict]:
        rng = np.random.RandomState(42)
        projects = [f'project_{i}' for i in range(n_projects)]
        historical = []
        for _ in range(n_epochs):
            contributions = {
                p: list(np.maximum(0.1, rng.lognormal(mean=1.5, sigma=0.8, size=rng.randint(2, 8))))
                for p in projects
            }
            dependencies = []
            for i in range(1, n_projects):
                if rng.rand() > 0.5:
                    dependencies.append((projects[i], projects[rng.randint(0, i)]))
            actual_impact = {p: float(rng.uniform(0.2, 1.0)) for p in projects}
            historical.append({
                'contributions': contributions,
                'dependencies': dependencies,
                'actual_impact': actual_impact,
            })
        return historical
