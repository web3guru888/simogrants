"""
SIMOGRANTS — End-to-end pipeline endpoints.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import asdict
from fastapi import APIRouter, BackgroundTasks, HTTPException

from src.database import db
from src.models import PipelineRequest, PipelineStatusResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.post("/run")
async def run_pipeline(req: PipelineRequest, background_tasks: BackgroundTasks):
    """Run the full SIMOGRANTS pipeline for one or more projects."""
    run_id = str(uuid.uuid4())
    project_ids = []

    # Create or reuse projects
    for project in req.projects:
        project_id = project.name.lower().replace(" ", "-")
        existing = await db.get_project(project_id)
        if not existing:
            await db.create_project(
                project_id=project_id,
                name=project.name,
                description=project.description,
                github_url=project.github_url,
                contract_addresses=project.contract_addresses,
                defillama_slug=project.defillama_slug,
                snapshot_space=project.snapshot_space,
                package_names=project.package_names,
            )
        project_ids.append(project_id)

    await db.create_pipeline_run(run_id, project_ids, req.matching_pool)
    background_tasks.add_task(_execute_pipeline, run_id, project_ids, req.matching_pool, req.publish_onchain)

    return {
        "run_id": run_id,
        "status": "pending",
        "project_ids": project_ids,
        "message": "Pipeline started",
    }


@router.get("/status/{run_id}", response_model=PipelineStatusResponse)
async def get_pipeline_status(run_id: str):
    """Check pipeline run status."""
    run = await db.get_pipeline_run(run_id)
    if not run:
        raise HTTPException(404, f"Pipeline run '{run_id}' not found")

    return PipelineStatusResponse(
        run_id=run["run_id"],
        status=run["status"],
        project_ids=run["project_ids"],
        matching_pool=run["matching_pool"],
        started_at=run["started_at"],
        completed_at=run.get("completed_at"),
        error=run.get("error"),
    )


@router.get("/results/{run_id}")
async def get_pipeline_results(run_id: str):
    """Get pipeline results once complete."""
    run = await db.get_pipeline_run(run_id)
    if not run:
        raise HTTPException(404, f"Pipeline run '{run_id}' not found")
    if run["status"] != "complete":
        raise HTTPException(400, f"Pipeline run status is '{run['status']}', not complete")
    return run.get("results", {})


async def _execute_pipeline(run_id: str, project_ids: list[str], matching_pool: float, publish_onchain: bool):
    """Background execution of the full pipeline."""
    results = {
        "profiles": {},
        "evaluations": {},
        "allocations": {},
        "attestations": {},
    }

    try:
        # 1. Collect
        await db.update_pipeline_run(run_id, "collecting")
        try:
            from src.collectors.orchestrator import CollectionOrchestrator
            from src.config import settings
            collector = CollectionOrchestrator({
                "github_token": settings.github_token,
                "etherscan_key": settings.etherscan_api_key,
            })
        except ImportError:
            collector = None

        for pid in project_ids:
            project = await db.get_project(pid)
            if collector and project:
                profile = await collector.collect_project({
                    "name": project["name"],
                    "description": project["description"],
                    "github_url": project.get("github_url"),
                    "contract_addresses": project.get("contract_addresses"),
                    "defillama_slug": project.get("defillama_slug"),
                    "snapshot_space": project.get("snapshot_space"),
                    "package_names": project.get("package_names"),
                })
                profile_dict = asdict(profile)
                await db.save_profile(pid, profile_dict, profile.data_completeness)
                results["profiles"][pid] = profile_dict

        # 2. Evaluate
        await db.update_pipeline_run(run_id, "evaluating")
        try:
            from src.evaluator.engine import EvaluationEngine
            from src.config import settings
            evaluator = EvaluationEngine(settings.anthropic_api_key, settings.evaluator_model)
        except ImportError:
            evaluator = None

        for pid in project_ids:
            profile = await db.get_profile(pid)
            if evaluator and profile:
                evaluation = await evaluator.evaluate_project(profile["profile_data"])
                eval_dict = asdict(evaluation)
                await db.save_evaluation(pid, eval_dict, evaluation.overall_score, evaluation.data_completeness)
                results["evaluations"][pid] = eval_dict

        # 3. Allocate
        await db.update_pipeline_run(run_id, "allocating")
        try:
            from src.mechanism.sqf import SQFMechanism
            from src.mechanism.dependency_graph import build_dependency_edges_from_known
            mechanism = SQFMechanism(matching_pool=matching_pool)

            # Collect evaluation scores
            evaluation_scores: dict[str, float] = {}
            project_github_orgs: dict[str, str] = {}
            for pid in project_ids:
                ev = await db.get_evaluation(pid)
                evaluation_scores[pid] = ev.get("overall_score", 50.0) if ev else 50.0
                # Extract GitHub org from project data for dependency graph
                project = await db.get_project(pid)
                if project and project.get("github_url"):
                    url = project["github_url"]
                    # Extract org from URL like https://github.com/OpenZeppelin/...
                    parts = url.rstrip("/").split("/")
                    if len(parts) >= 4:
                        project_github_orgs[pid] = parts[3].lower()

            # Build dependency graph from known relationships
            dependencies = build_dependency_edges_from_known(project_ids, project_github_orgs)

            # Use the fixed score-based allocation (fixed contributor count)
            allocations = mechanism.compute_allocation_from_scores(evaluation_scores, dependencies)
            await db.save_allocation(1, allocations, matching_pool, mechanism.pheromone.get_state())
            results["allocations"] = allocations
        except ImportError:
            pass

        # 4. Attest (optional)
        if publish_onchain:
            await db.update_pipeline_run(run_id, "attesting")
            import hashlib, json
            for pid in project_ids:
                ev = await db.get_evaluation(pid)
                if ev:
                    payload = json.dumps(ev["evaluation_data"], sort_keys=True)
                    evaluation_hash = "0x" + hashlib.sha256(payload.encode()).hexdigest()
                    await db.save_attestation(pid, evaluation_hash, epoch=1)
                    results["attestations"][pid] = {"evaluation_hash": evaluation_hash}

        await db.update_pipeline_run(run_id, "complete", results=results)

    except Exception as e:
        logger.error(f"Pipeline run {run_id} failed: {e}")
        await db.update_pipeline_run(run_id, "failed", error=str(e))
