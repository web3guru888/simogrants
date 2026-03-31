"""
SIMOGRANTS — Mechanism (SQF) endpoints.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException

from src.database import db
from src.models import (
    AllocateRequest,
    AllocationResponse,
    PheromoneResponse,
    PageRankResponse,
    BacktestRequest,
    BacktestResponse,
    EpochAdvanceRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mechanism", tags=["mechanism"])

# Module-level state for the current epoch
_current_epoch = 1


@router.post("/allocate", response_model=AllocationResponse)
async def compute_allocation(req: AllocateRequest):
    """Compute SQF allocation for a set of projects."""
    global _current_epoch

    try:
        from src.mechanism.sqf import SQFMechanism

        mechanism = SQFMechanism(
            matching_pool=req.matching_pool,
        )

        # Build contributions from evaluation scores if not provided
        contributions = req.contributions or {}
        if not contributions:
            # Use evaluation scores as synthetic contributions
            for pid in req.project_ids:
                eval_data = await db.get_evaluation(pid)
                if eval_data:
                    score = eval_data.get("overall_score", 50.0)
                    # Synthetic: score maps to number/size of "virtual donors"
                    n_donors = max(1, int(score / 10))
                    donation_size = score / 10.0
                    contributions[pid] = [donation_size] * n_donors
                else:
                    contributions[pid] = [1.0]  # minimal contribution

        # Build dependencies
        dependencies = []
        if req.dependencies:
            dependencies = [(d[0], d[1]) for d in req.dependencies]

        # Compute allocation
        allocations = mechanism.compute_allocation(
            contributions=contributions,
            dependencies=dependencies,
        )

        # Get modifiers for each project
        pr_scores = mechanism.pagerank.compute_pagerank() if dependencies else {}
        modifiers = {}
        for pid in allocations:
            modifiers[pid] = {
                "pheromone": mechanism.pheromone.get_modifier(pid),
                "pagerank": mechanism.pagerank.get_modifier(pid, pr_scores),
                "qf_base": mechanism.qf.calculate(
                    {pid: contributions.get(pid, [1.0])}, req.matching_pool
                ).get(pid, 0),
            }

        # Save allocation
        await db.save_allocation(
            epoch=_current_epoch,
            allocation_data=allocations,
            matching_pool=req.matching_pool,
            pheromone_state=mechanism.pheromone.get_state(),
        )

        return AllocationResponse(
            epoch=_current_epoch,
            matching_pool=req.matching_pool,
            allocations=allocations,
            modifiers=modifiers,
            pheromone_state=mechanism.pheromone.get_state(),
        )

    except ImportError:
        raise HTTPException(503, "Mechanism module not yet available")
    except Exception as e:
        logger.error(f"Allocation failed: {e}")
        raise HTTPException(500, f"Allocation failed: {str(e)}")


@router.get("/pheromone", response_model=PheromoneResponse)
async def get_pheromone():
    """Get current pheromone state."""
    alloc = await db.get_latest_allocation()
    state = alloc["pheromone_state"] if alloc else {}
    return PheromoneResponse(state=state or {}, epoch=_current_epoch)


@router.get("/pagerank", response_model=PageRankResponse)
async def get_pagerank():
    """Get current PageRank scores."""
    try:
        from src.mechanism.pagerank import PageRankEngine
        engine = PageRankEngine()
        scores = engine.compute_pagerank()
        return PageRankResponse(scores=scores, graph_size=len(engine.graph))
    except ImportError:
        raise HTTPException(503, "Mechanism module not yet available")


@router.post("/epoch/advance")
async def advance_epoch(req: EpochAdvanceRequest):
    """Advance to next epoch with accuracy feedback."""
    global _current_epoch

    try:
        from src.mechanism.sqf import SQFMechanism
        mechanism = SQFMechanism()
        
        # Load pheromone state from last allocation
        alloc = await db.get_latest_allocation()
        if alloc and alloc.get("pheromone_state"):
            mechanism.pheromone.load_state(alloc["pheromone_state"])

        mechanism.advance_epoch(req.accuracy_scores)
        _current_epoch += 1

        return {
            "epoch": _current_epoch,
            "pheromone_state": mechanism.pheromone.get_state(),
        }

    except ImportError:
        raise HTTPException(503, "Mechanism module not yet available")


@router.post("/backtest", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest):
    """Run backtesting simulation."""
    try:
        from src.mechanism.backtest import BacktestingEngine

        engine = BacktestingEngine()
        synthetic = engine.generate_synthetic_data(
            n_projects=req.n_projects,
            n_epochs=req.n_epochs,
        )
        result = engine.run_backtest(
            historical_data=synthetic,
            config={"matching_pool": req.matching_pool},
        )

        return BacktestResponse(
            epochs=result.epochs,
            summary=result.summary,
        )

    except ImportError:
        raise HTTPException(503, "Mechanism module not yet available")
    except Exception as e:
        logger.error(f"Backtest failed: {e}")
        raise HTTPException(500, f"Backtest failed: {str(e)}")


@router.get("/config")
async def get_mechanism_config():
    """Get current mechanism parameters."""
    from src.config import settings

    return {
        "matching_pool": settings.matching_pool,
        "pheromone": {
            "initial": settings.pheromone_initial,
            "min": settings.pheromone_min,
            "max": settings.pheromone_max,
            "decay_rate": settings.pheromone_decay_rate,
        },
        "pagerank": {
            "damping": settings.pagerank_damping,
        },
        "anti_goodhart": {
            "active_dimensions": settings.anti_goodhart_active_dims,
        },
        "current_epoch": _current_epoch,
    }
