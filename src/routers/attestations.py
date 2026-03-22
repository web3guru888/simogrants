"""
SIMOGRANTS — On-chain attestation endpoints.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from src.database import db
from src.models import AttestRequest, AttestationResponse, BatchAttestRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/attestations", tags=["attestations"])


@router.post("/publish", response_model=AttestationResponse)
async def publish_attestation(req: AttestRequest):
    """Publish an on-chain attestation for a project evaluation."""
    evaluation = await db.get_evaluation(req.project_id)
    if not evaluation:
        raise HTTPException(404, f"No evaluation found for '{req.project_id}'")

    try:
        # Compute deterministic hash of evaluation JSON
        payload = json.dumps(evaluation["evaluation_data"], sort_keys=True)
        evaluation_hash = "0x" + hashlib.sha256(payload.encode()).hexdigest()

        # Save placeholder attestation (blockchain integration will update later)
        attested_at = datetime.now(timezone.utc).isoformat()
        await db.save_attestation(
            project_id=req.project_id,
            evaluation_hash=evaluation_hash,
            filecoin_cid=None,
            tx_hash=None,
            epoch=1,
        )

        return AttestationResponse(
            project_id=req.project_id,
            evaluation_hash=evaluation_hash,
            filecoin_cid=None,
            tx_hash=None,
            epoch=1,
            attested_at=attested_at,
        )

    except Exception as e:
        logger.error(f"Attestation failed for {req.project_id}: {e}")
        raise HTTPException(500, f"Attestation failed: {str(e)}")


@router.get("/{project_id}", response_model=list[AttestationResponse])
async def get_attestations(project_id: str):
    """Get attestation history for a project."""
    attestations = await db.get_attestations(project_id)
    return [AttestationResponse(**a) for a in attestations]


@router.post("/batch")
async def batch_publish(req: BatchAttestRequest):
    """Batch publish attestations."""
    results = {}
    errors = {}

    for pid in req.project_ids:
        try:
            evaluation = await db.get_evaluation(pid)
            if not evaluation:
                errors[pid] = "No evaluation found"
                continue

            payload = json.dumps(evaluation["evaluation_data"], sort_keys=True)
            evaluation_hash = "0x" + hashlib.sha256(payload.encode()).hexdigest()
            await db.save_attestation(pid, evaluation_hash, epoch=1)
            results[pid] = {"evaluation_hash": evaluation_hash, "status": "saved"}

        except Exception as e:
            errors[pid] = str(e)
            logger.error(f"Batch attestation failed for {pid}: {e}")

    return {"results": results, "errors": errors}


@router.get("/verify/{tx_hash}")
async def verify_attestation(tx_hash: str):
    """Verify an attestation transaction. Placeholder until blockchain integration lands."""
    return {
        "tx_hash": tx_hash,
        "verified": False,
        "message": "Blockchain verification pending integration",
    }
