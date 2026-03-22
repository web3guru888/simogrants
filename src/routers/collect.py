"""
SIMOGRANTS — Data collection endpoints.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException

from src.database import db
from src.models import CollectRequest, ProfileResponse, BatchCollectRequest

logger = logging.getLogger(__name__)
router = APIRouter(tags=["collection"])


@router.post("/projects/{project_id}/collect", response_model=ProfileResponse)
async def collect_project(project_id: str, req: CollectRequest | None = None):
    """Trigger data collection for a project."""
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(404, f"Project '{project_id}' not found")

    # Use cached profile unless force_recollect
    if not (req and req.force_recollect):
        cached = await db.get_profile(project_id)
        if cached:
            return ProfileResponse(
                project_id=project_id,
                data_completeness=cached["data_completeness"],
                collected_at=cached["collected_at"],
                profile=cached["profile_data"],
            )

    try:
        from src.collectors.orchestrator import CollectionOrchestrator
        from src.config import settings

        orchestrator = CollectionOrchestrator(
            config={
                "github_token": settings.github_token,
                "etherscan_key": settings.etherscan_api_key,
            }
        )

        project_input = {
            "name": project["name"],
            "description": project["description"],
            "github_url": project.get("github_url"),
            "contract_addresses": project.get("contract_addresses"),
            "defillama_slug": project.get("defillama_slug"),
            "snapshot_space": project.get("snapshot_space"),
            "package_names": project.get("package_names"),
        }

        profile = await orchestrator.collect_project(project_input)

        # Serialize and save
        from dataclasses import asdict
        profile_dict = asdict(profile)
        await db.save_profile(
            project_id=project_id,
            profile_data=profile_dict,
            data_completeness=profile.data_completeness,
        )

        return ProfileResponse(
            project_id=project_id,
            data_completeness=profile.data_completeness,
            collected_at=profile.collected_at,
            profile=profile_dict,
        )

    except ImportError:
        raise HTTPException(503, "Collectors module not yet available")
    except Exception as e:
        logger.error(f"Collection failed for {project_id}: {e}")
        raise HTTPException(500, f"Collection failed: {str(e)}")


@router.get("/projects/{project_id}/profile", response_model=ProfileResponse)
async def get_profile(project_id: str):
    """Get the latest collected profile for a project."""
    profile = await db.get_profile(project_id)
    if not profile:
        raise HTTPException(404, f"No profile found for '{project_id}'")

    return ProfileResponse(
        project_id=project_id,
        data_completeness=profile["data_completeness"],
        collected_at=profile["collected_at"],
        profile=profile["profile_data"],
    )


@router.post("/collect/batch")
async def batch_collect(req: BatchCollectRequest):
    """Collect data for multiple projects."""
    results = {}
    errors = {}

    for pid in req.project_ids:
        try:
            project = await db.get_project(pid)
            if not project:
                errors[pid] = "Project not found"
                continue

            from src.collectors.orchestrator import CollectionOrchestrator
            from src.config import settings
            from dataclasses import asdict

            orchestrator = CollectionOrchestrator(
                config={
                    "github_token": settings.github_token,
                    "etherscan_key": settings.etherscan_api_key,
                }
            )

            project_input = {
                "name": project["name"],
                "description": project["description"],
                "github_url": project.get("github_url"),
                "contract_addresses": project.get("contract_addresses"),
                "defillama_slug": project.get("defillama_slug"),
                "snapshot_space": project.get("snapshot_space"),
                "package_names": project.get("package_names"),
            }

            profile = await orchestrator.collect_project(project_input)
            profile_dict = asdict(profile)
            await db.save_profile(pid, profile_dict, profile.data_completeness)
            results[pid] = profile_dict

        except Exception as e:
            errors[pid] = str(e)
            logger.error(f"Batch collect failed for {pid}: {e}")

    return {"results": results, "errors": errors}
