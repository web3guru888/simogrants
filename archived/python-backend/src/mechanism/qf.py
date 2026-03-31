from __future__ import annotations

import math


class QFEngine:
    """Standard Quadratic Funding calculation with optional cap."""

    def __init__(self, cap_per_project: float = 0.25):
        self.cap_per_project = cap_per_project

    def calculate(self, contributions: dict[str, list[float]], matching_pool: float) -> dict[str, float]:
        if not contributions:
            return {}

        qf_scores: dict[str, float] = {}
        for project, contribs in contributions.items():
            cleaned = [max(0.0, float(c)) for c in contribs if c is not None]
            sqrt_sum = sum(math.sqrt(c) for c in cleaned)
            qf_scores[project] = float(sqrt_sum ** 2)

        total = sum(qf_scores.values())
        if total <= 0:
            equal = matching_pool / len(contributions)
            return {p: equal for p in contributions}

        alloc = {p: (score / total) * matching_pool for p, score in qf_scores.items()}
        return self._apply_cap(alloc, matching_pool)

    def _apply_cap(self, allocations: dict[str, float], matching_pool: float) -> dict[str, float]:
        cap = matching_pool * self.cap_per_project
        if not allocations:
            return {}

        capped = dict(allocations)
        for _ in range(10):
            over = {p: v for p, v in capped.items() if v > cap}
            if not over:
                return capped
            excess = sum(v - cap for v in over.values())
            for p in over:
                capped[p] = cap
            under = [p for p, v in capped.items() if v < cap]
            if not under or excess <= 0:
                break
            under_total = sum(capped[p] for p in under)
            if under_total <= 0:
                share = excess / len(under)
                for p in under:
                    capped[p] += share
            else:
                for p in under:
                    capped[p] += excess * (capped[p] / under_total)
        return capped
