"""
SIMOGRANTS — Evaluation endpoints.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException

from src.database import db
from src.models import (
    EvaluateRequest,
    EvaluationResponse,
    BatchEvaluateRequest,
    TensionResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/evaluate", tags=["evaluation"])


@router.post("/projects/{project_id}", response_model=EvaluationResponse)
async def evaluate_project(project_id: str, req: EvaluateRequest | None = None):
    """Run stakeholder evaluation on a project."""
    # Check project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(404, f"Project '{project_id}' not found")

    # Check for existing profile
    profile = await db.get_profile(project_id)
    if not profile:
        raise HTTPException(
            400,
            f"No collected profile for '{project_id}'. Run /projects/{project_id}/collect first.",
        )

    # Run evaluation
    try:
        from src.evaluator.engine import EvaluationEngine
        from src.config import settings

        engine = EvaluationEngine(
            api_key=settings.anthropic_api_key,
            model=settings.evaluator_model,
        )
        result = await engine.evaluate_project(profile["profile_data"])

        # Save to database
        await db.save_evaluation(
            project_id=project_id,
            evaluation_data=_evaluation_to_dict(result),
            overall_score=result.overall_score,
            data_completeness=result.data_completeness,
        )

        return _evaluation_to_dict(result)

    except ImportError:
        raise HTTPException(503, "Evaluator module not yet available")
    except Exception as e:
        logger.error(f"Evaluation failed for {project_id}: {e}")
        raise HTTPException(500, f"Evaluation failed: {str(e)}")


@router.get("/projects/{project_id}", response_model=EvaluationResponse)
async def get_evaluation(project_id: str):
    """Get the latest evaluation for a project."""
    evaluation = await db.get_evaluation(project_id)
    if not evaluation:
        raise HTTPException(404, f"No evaluation found for '{project_id}'")
    return evaluation["evaluation_data"]


@router.get("/projects/{project_id}/tensions", response_model=list[TensionResponse])
async def get_tensions(project_id: str):
    """Get tension analysis for a project."""
    evaluation = await db.get_evaluation(project_id)
    if not evaluation:
        raise HTTPException(404, f"No evaluation found for '{project_id}'")
    return evaluation["evaluation_data"].get("tensions", [])


@router.post("/batch")
async def batch_evaluate(req: BatchEvaluateRequest):
    """Evaluate multiple projects."""
    results = {}
    errors = {}
    for pid in req.project_ids:
        try:
            profile = await db.get_profile(pid)
            if not profile:
                errors[pid] = "No collected profile"
                continue

            from src.evaluator.engine import EvaluationEngine
            from src.config import settings

            engine = EvaluationEngine(
                api_key=settings.anthropic_api_key,
                model=settings.evaluator_model,
            )
            result = await engine.evaluate_project(profile["profile_data"])
            result_dict = _evaluation_to_dict(result)

            await db.save_evaluation(
                project_id=pid,
                evaluation_data=result_dict,
                overall_score=result.overall_score,
                data_completeness=result.data_completeness,
            )
            results[pid] = result_dict

        except Exception as e:
            errors[pid] = str(e)
            logger.error(f"Batch evaluation failed for {pid}: {e}")

    return {"results": results, "errors": errors}


def _evaluation_to_dict(result) -> dict:
    """Convert an EvaluationResult to a serializable dict."""
    from dataclasses import asdict

    try:
        return asdict(result)
    except Exception:
        # Fallback if it's already a dict
        if isinstance(result, dict):
            return result
        return {"error": "Could not serialize evaluation result"}
