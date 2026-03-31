"""
SIMOGRANTS Evaluator — Data Models

Core data structures for multi-stakeholder project evaluation.
All models use dataclasses with full type hints.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


# ---------------------------------------------------------------------------
# Dimension score (one axis of one stakeholder's evaluation)
# ---------------------------------------------------------------------------

@dataclass
class DimensionScore:
    """A single scored dimension (0-100) with justification."""
    score: int          # 0-100
    justification: str  # 1-3 sentence explanation from the LLM

    def __post_init__(self) -> None:
        if not (0 <= self.score <= 100):
            raise ValueError(f"Score must be 0-100, got {self.score}")


# ---------------------------------------------------------------------------
# Individual stakeholder evaluation
# ---------------------------------------------------------------------------

@dataclass
class StakeholderEvaluation:
    """Result from a single stakeholder agent evaluating a project."""
    agent_type: str                       # 'developer' | 'user' | 'funder' | 'ecosystem'
    project_id: str
    scores: dict[str, DimensionScore]     # dimension_name -> DimensionScore
    overall_narrative: str                # 2-4 sentence summary from agent
    confidence: float                     # 0.0-1.0 based on data completeness
    evaluated_at: str                     # ISO 8601 timestamp

    # Dimensions per agent type (class-level reference)
    DIMENSIONS: dict[str, list[str]] = field(default=None, init=False, repr=False)

    def __post_init__(self) -> None:
        if self.agent_type not in STAKEHOLDER_DIMENSIONS:
            raise ValueError(
                f"Unknown agent_type '{self.agent_type}'. "
                f"Must be one of {list(STAKEHOLDER_DIMENSIONS.keys())}"
            )
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"Confidence must be 0.0-1.0, got {self.confidence}")

    @property
    def mean_score(self) -> float:
        """Average across all dimension scores for this agent."""
        if not self.scores:
            return 0.0
        return sum(d.score for d in self.scores.values()) / len(self.scores)

    def to_dict(self) -> dict:
        return {
            "agent_type": self.agent_type,
            "project_id": self.project_id,
            "scores": {
                k: {"score": v.score, "justification": v.justification}
                for k, v in self.scores.items()
            },
            "overall_narrative": self.overall_narrative,
            "confidence": self.confidence,
            "mean_score": round(self.mean_score, 2),
            "evaluated_at": self.evaluated_at,
        }


# ---------------------------------------------------------------------------
# Tension (disagreement between stakeholders on a dimension)
# ---------------------------------------------------------------------------

@dataclass
class Tension:
    """Represents significant disagreement between stakeholders on a dimension."""
    dimension: str
    agents: dict[str, int]    # agent_type -> score
    spread: int               # max - min
    high_agent: str           # agent with highest score
    low_agent: str            # agent with lowest score
    narrative: str = ""       # human-readable explanation

    def to_dict(self) -> dict:
        return {
            "dimension": self.dimension,
            "agents": self.agents,
            "spread": self.spread,
            "high_agent": self.high_agent,
            "low_agent": self.low_agent,
            "narrative": self.narrative,
        }


# ---------------------------------------------------------------------------
# Aggregated evaluation result
# ---------------------------------------------------------------------------

@dataclass
class EvaluationResult:
    """Complete evaluation result for a project across all stakeholders."""
    project_id: str
    stakeholder_evaluations: list[StakeholderEvaluation]
    aggregated_scores: dict[str, float]            # dimension -> weighted avg
    overall_score: float                           # 0-100 composite
    bradley_terry_rank: Optional[float] = None     # BT strength parameter
    tensions: list[Tension] = field(default_factory=list)
    data_completeness: float = 0.0                 # 0.0-1.0
    evaluated_at: str = ""

    def __post_init__(self) -> None:
        if not self.evaluated_at:
            self.evaluated_at = datetime.now(timezone.utc).isoformat()

    @property
    def has_tensions(self) -> bool:
        return len(self.tensions) > 0

    @property
    def tension_count(self) -> int:
        return len(self.tensions)

    def to_dict(self) -> dict:
        return {
            "project_id": self.project_id,
            "stakeholder_evaluations": [
                e.to_dict() for e in self.stakeholder_evaluations
            ],
            "aggregated_scores": self.aggregated_scores,
            "overall_score": round(self.overall_score, 2),
            "bradley_terry_rank": self.bradley_terry_rank,
            "tensions": [t.to_dict() for t in self.tensions],
            "data_completeness": self.data_completeness,
            "evaluated_at": self.evaluated_at,
        }


# ---------------------------------------------------------------------------
# Constants: dimension names per stakeholder
# ---------------------------------------------------------------------------

STAKEHOLDER_DIMENSIONS: dict[str, list[str]] = {
    "developer": ["code_quality", "maintenance_health", "security_posture"],
    "user": ["adoption_metrics", "community_engagement", "user_experience"],
    "funder": ["capital_efficiency", "funding_sustainability", "track_record"],
    "ecosystem": ["composability", "network_effects", "mission_alignment"],
}

# All unique dimension names across all stakeholders
ALL_DIMENSIONS: list[str] = sorted(
    {dim for dims in STAKEHOLDER_DIMENSIONS.values() for dim in dims}
)

# Human-readable labels
DIMENSION_LABELS: dict[str, str] = {
    "code_quality": "Code Quality",
    "maintenance_health": "Maintenance Health",
    "security_posture": "Security Posture",
    "adoption_metrics": "Adoption Metrics",
    "community_engagement": "Community Engagement",
    "user_experience": "User Experience",
    "capital_efficiency": "Capital Efficiency",
    "funding_sustainability": "Funding Sustainability",
    "track_record": "Track Record",
    "composability": "Composability",
    "network_effects": "Network Effects",
    "mission_alignment": "Mission Alignment",
}
