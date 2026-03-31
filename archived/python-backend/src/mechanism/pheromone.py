from __future__ import annotations


class PheromoneTracker:
    INITIAL = 5.0
    MIN = 0.0
    MAX = 10.0
    DECAY_RATE = 0.2
    DEPOSIT_RATE = 0.5

    def __init__(self):
        self.pheromones: dict[str, float] = {}

    def get_level(self, project_id: str) -> float:
        return float(self.pheromones.get(project_id, self.INITIAL))

    def decay_all(self):
        for pid in list(self.pheromones):
            self.pheromones[pid] = self._clamp(self.pheromones[pid] * (1 - self.DECAY_RATE))

    def deposit(self, project_id: str, accuracy: float):
        current = self.get_level(project_id)
        delta = self.DEPOSIT_RATE * max(0.0, min(1.0, float(accuracy)))
        self.pheromones[project_id] = self._clamp(current + delta)

    def get_modifier(self, project_id: str) -> float:
        level = self.get_level(project_id)
        return 0.5 + (level / 10.0)

    def get_state(self) -> dict[str, float]:
        return dict(self.pheromones)

    def load_state(self, state: dict[str, float]):
        self.pheromones = {k: self._clamp(float(v)) for k, v in state.items()}

    def _clamp(self, value: float) -> float:
        return max(self.MIN, min(self.MAX, float(value)))
