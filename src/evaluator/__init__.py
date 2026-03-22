"""
SIMOGRANTS Evaluator — Multi-Stakeholder Project Evaluation

This package provides LLM-based evaluation of Ethereum public goods projects
from 4 stakeholder perspectives (Developer, User, Funder, Ecosystem), with
Bradley-Terry aggregation and tension detection.

Usage:
    from evaluator import EvaluationEngine, EvaluationResult

    engine = EvaluationEngine(api_key="sk-ant-...")
    result = await engine.evaluate_project(profile_data)
"""
from __future__ import annotations

from .models import (
    DimensionScore,
    StakeholderEvaluation,
    Tension,
    EvaluationResult,
    STAKEHOLDER_DIMENSIONS,
    ALL_DIMENSIONS,
    DIMENSION_LABELS,
)
from .engine import EvaluationEngine
from .bradley_terry import (
    bradley_terry_aggregate,
    generate_pairwise_comparisons,
    bt_rank_to_percentile,
)
from .tension import detect_tensions, summarize_tensions
from .prompts import build_system_prompt, build_user_message

__all__ = [
    # Models
    "DimensionScore",
    "StakeholderEvaluation",
    "Tension",
    "EvaluationResult",
    "STAKEHOLDER_DIMENSIONS",
    "ALL_DIMENSIONS",
    "DIMENSION_LABELS",
    # Engine
    "EvaluationEngine",
    # Bradley-Terry
    "bradley_terry_aggregate",
    "generate_pairwise_comparisons",
    "bt_rank_to_percentile",
    # Tension
    "detect_tensions",
    "summarize_tensions",
    # Prompts
    "build_system_prompt",
    "build_user_message",
]

__version__ = "0.1.0"
