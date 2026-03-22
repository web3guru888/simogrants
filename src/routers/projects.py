"""
SIMOGRANTS — Project management endpoints.
"""
from __future__ import annotations

import json
import logging
import re
from fastapi import APIRouter, HTTPException

from src.database import db
from src.models import ProjectCreate, ProjectResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])


def _make_project_id(name: str) -> str:
    """Generate a URL-safe project ID from name."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "project"


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(req: ProjectCreate):
    """Create a new project entry."""
    project_id = _make_project_id(req.name)

    # Check for duplicates
    existing = await db.get_project(project_id)
    if existing:
        raise HTTPException(400, f"Project '{project_id}' already exists")

    result = await db.create_project(
        project_id=project_id,
        name=req.name,
        description=req.description,
        github_url=req.github_url,
        contract_addresses=req.contract_addresses,
        defillama_slug=req.defillama_slug,
        snapshot_space=req.snapshot_space,
        package_names=req.package_names,
    )
    return _format_project(result)


@router.get("", response_model=list[ProjectResponse])
async def list_projects():
    """List all projects."""
    projects = await db.list_projects()
    return [_format_project(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get a single project."""
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(404, f"Project '{project_id}' not found")
    return _format_project(project)


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    deleted = await db.delete_project(project_id)
    if not deleted:
        raise HTTPException(404, f"Project '{project_id}' not found")
    return {"deleted": True, "project_id": project_id}


def _format_project(row: dict) -> dict:
    """Format a database row into a ProjectResponse."""
    result = dict(row)
    # Parse JSON fields
    for field in ("contract_addresses", "package_names"):
        if result.get(field) and isinstance(result[field], str):
            try:
                result[field] = json.loads(result[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return result
