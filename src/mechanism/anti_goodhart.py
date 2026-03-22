from __future__ import annotations

import numpy as np


class AntiGoodhartRotation:
    ALL_DIMENSIONS = [
        'code_quality', 'maintenance_health', 'security_posture',
        'adoption', 'community', 'ux',
        'capital_efficiency', 'sustainability', 'track_record',
        'composability', 'network_effects', 'alignment'
    ]

    def __init__(self, active_count: int = 8):
        self.active_count = active_count

    def get_active_dimensions(self, epoch: int) -> list[str]:
        rng = np.random.RandomState(seed=epoch * 42 + 7)
        indices = rng.choice(len(self.ALL_DIMENSIONS), self.active_count, replace=False)
        return [self.ALL_DIMENSIONS[i] for i in sorted(indices)]

    def compute_weighted_score(self, scores: dict[str, float], epoch: int) -> float:
        active = self.get_active_dimensions(epoch)
        active_scores = [float(scores[d]) for d in active if d in scores]
        if not active_scores:
            return 0.0
        return sum(active_scores) / len(active_scores)
