"""
SIMOGRANTS — Stigmergic Impact Oracle for Public Goods
Main FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.database import db
from src.routers import health, projects, collect, evaluate, mechanism, attestations, pipeline

VERSION = "0.2.0"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    app.state.started_at = datetime.now(timezone.utc).isoformat()
    await db.connect()
    logger.info("SIMOGRANTS API started")
    yield
    await db.close()
    logger.info("SIMOGRANTS API stopped")


app = FastAPI(
    title="SIMOGRANTS",
    description="Stigmergic Impact Oracle for Public Goods — "
                "Multi-agent evaluation and Stigmergic Quadratic Funding",
    version=VERSION,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(projects.router)
app.include_router(collect.router)
app.include_router(evaluate.router)
app.include_router(mechanism.router)
app.include_router(attestations.router)
app.include_router(pipeline.router)


@app.get("/version")
async def version():
    """Version and component info."""
    return {
        "version": VERSION,
        "components": {
            "collector": "ready",
            "evaluator": "ready-if-module-present",
            "mechanism": "ready-if-module-present",
            "blockchain": "pending",
            "database": "sqlite-ready",
            "api": "fastapi-ready",
        },
        "started_at": getattr(app.state, "started_at", None),
    }
