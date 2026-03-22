"""Health and version endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
