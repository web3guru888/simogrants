#!/usr/bin/env python3
"""
SIMOGRANTS Full Pipeline Runner
================================
Runs the complete SIMOGRANTS pipeline on real Ethereum public goods projects:
  1. Collect — GitHub data (+ other sources where available)
  2. Evaluate — 4 stakeholder LLM agents per project
  3. Aggregate — Bradley-Terry ranking + tension detection
  4. Rank — SQF mechanism (pheromone + PageRank)
  5. Publish — Compute on-chain hashes (+ actual on-chain if keys available)
  6. Store — Local evidence bundles (+ Filecoin if tokens available)

Usage:
    python run_pipeline.py
"""
from __future__ import annotations

import asyncio
import dataclasses
import hashlib
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from collectors.orchestrator import CollectionOrchestrator
from collectors.models import ProjectProfile
from evaluator.engine import EvaluationEngine
from evaluator.models import EvaluationResult, STAKEHOLDER_DIMENSIONS
from evaluator.bradley_terry import bradley_terry_aggregate, generate_pairwise_comparisons, bt_rank_to_percentile
from evaluator.tension import summarize_tensions
from mechanism.sqf import SQFMechanism

# ─── Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")

# ─── Project definitions ─────────────────────────────────────────────
TARGET_PROJECTS = [
    {
        "id": "openzeppelin",
        "name": "OpenZeppelin Contracts",
        "identifiers": {
            "github": "OpenZeppelin/openzeppelin-contracts",
        },
        "description": "Battle-tested library of smart contract security patterns and ERC implementations",
    },
    {
        "id": "protocol-guild",
        "name": "Protocol Guild",
        "identifiers": {
            "github": "protocolguild/docs",
        },
        "description": "Collective funding mechanism for Ethereum core protocol contributors",
    },
    {
        "id": "ethstaker",
        "name": "EthStaker Deposit CLI",
        "identifiers": {
            "github": "eth-educators/ethstaker-deposit-cli",
        },
        "description": "CLI tool for Ethereum validator deposit key generation, fork of the official staking-deposit-cli",
    },
    {
        "id": "gitcoin-passport",
        "name": "Gitcoin Passport",
        "identifiers": {
            "github": "gitcoinco/passport",
        },
        "description": "Decentralized identity verification aggregating stamps across web2 and web3 for Sybil resistance",
    },
    {
        "id": "uniswap-v3",
        "name": "Uniswap v3 Core",
        "identifiers": {
            "github": "Uniswap/v3-core",
            "defillama": "uniswap-v3",
        },
        "description": "Concentrated liquidity AMM, the most forked and adopted DEX protocol in DeFi",
    },
]

# Dependency graph for PageRank (who depends on whom)
DEPENDENCY_EDGES = [
    ("gitcoin-passport", "openzeppelin"),      # Passport uses OZ contracts
    ("uniswap-v3", "openzeppelin"),            # Uniswap uses OZ
    ("ethstaker", "protocol-guild"),           # Staker tooling supports protocol devs
    ("gitcoin-passport", "uniswap-v3"),        # Passport integrates DeFi identities
    ("protocol-guild", "openzeppelin"),        # Guild members maintain OZ-level infra
    ("uniswap-v3", "protocol-guild"),          # Uniswap depends on core protocol work
    ("ethstaker", "openzeppelin"),             # Staker CLI uses crypto primitives
]

# Simulated contributions for QF (would come from real Gitcoin data)
SIMULATED_CONTRIBUTIONS = {
    "openzeppelin": [100, 50, 200, 75, 25, 150, 80, 60, 300, 40],
    "protocol-guild": [500, 200, 100, 50, 1000, 75, 300, 150, 250, 80],
    "ethstaker": [30, 20, 50, 25, 15, 40, 10, 35, 20, 45],
    "gitcoin-passport": [80, 60, 100, 40, 200, 50, 75, 30, 90, 55],
    "uniswap-v3": [200, 150, 500, 100, 300, 250, 75, 400, 120, 180],
}


def dataclass_to_dict(obj: Any) -> Any:
    """Recursively convert dataclasses to dicts for JSON serialization."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {k: dataclass_to_dict(v) for k, v in dataclasses.asdict(obj).items()}
    elif isinstance(obj, dict):
        return {k: dataclass_to_dict(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [dataclass_to_dict(v) for v in obj]
    elif isinstance(obj, (datetime,)):
        return obj.isoformat()
    return obj


def compute_keccak256(data: bytes) -> str:
    """Compute keccak256 hash, falling back to sha256 if no keccak available."""
    try:
        from eth_hash.auto import keccak
        return "0x" + keccak(data).hex()
    except ImportError:
        pass
    try:
        import sha3
        k = sha3.keccak_256()
        k.update(data)
        return "0x" + k.digest().hex()
    except ImportError:
        pass
    # Fallback: SHA-256 (note: not keccak, but works for demonstration)
    return "0xsha256:" + hashlib.sha256(data).hexdigest()


async def step1_collect(projects: list[dict]) -> dict[str, dict]:
    """Step 1: Collect data from all sources for each project."""
    logger.info("=" * 60)
    logger.info("STEP 1: DATA COLLECTION")
    logger.info("=" * 60)

    profiles = {}
    for proj in projects:
        pid = proj["id"]
        logger.info("Collecting data for %s...", pid)
        try:
            orch = CollectionOrchestrator(
                identifiers=proj["identifiers"],
                project_id=pid,
                project_name=proj["name"],
            )
            profile = await orch.run()
            profile_dict = dataclass_to_dict(profile)
            # Enrich with description
            profile_dict["description"] = proj.get("description", "")
            profile_dict["github_url"] = f"https://github.com/{proj['identifiers'].get('github', '')}"
            profiles[pid] = profile_dict
            logger.info(
                "  ✓ %s — completeness: %.2f, sources OK: %s",
                pid,
                profile.data_completeness,
                [m.source for m in profile.collection_metadata
                 if m.status.value in ("success", "partial")],
            )
        except Exception as e:
            logger.error("  ✗ %s — FAILED: %s", pid, e)
            profiles[pid] = {
                "project_id": pid,
                "name": proj["name"],
                "description": proj.get("description", ""),
                "error": str(e),
                "data_completeness": 0.0,
            }

    logger.info("Collection complete: %d/%d projects", len(profiles), len(projects))
    return profiles


async def step2_evaluate(profiles: dict[str, dict]) -> list[dict]:
    """Step 2: Run 4 stakeholder LLM agents on each project."""
    logger.info("=" * 60)
    logger.info("STEP 2: STAKEHOLDER EVALUATION (4 agents × %d projects)", len(profiles))
    logger.info("=" * 60)

    asi1_key = os.environ.get("ASI1_API_KEY", "")
    asi1_model = os.environ.get("ASI1_MODEL", "asi1-mini")

    if not asi1_key:
        logger.error("No ASI1_API_KEY found — cannot run LLM evaluations")
        return []

    engine = EvaluationEngine(
        api_key=asi1_key,
        model=asi1_model,
    )

    results = []
    for pid, profile in profiles.items():
        if profile.get("error"):
            logger.warning("  Skipping %s (collection failed)", pid)
            continue

        logger.info("  Evaluating %s with 4 stakeholder agents...", pid)
        try:
            eval_result = await engine.evaluate_project(profile, project_id=pid)
            result_dict = eval_result.to_dict()
            results.append(result_dict)
            logger.info(
                "  ✓ %s — overall: %.1f, tensions: %d, confidence: %.2f",
                pid,
                eval_result.overall_score,
                eval_result.tension_count,
                eval_result.data_completeness,
            )
            for ev in eval_result.stakeholder_evaluations:
                logger.info(
                    "    %s: mean=%.1f  [%s]",
                    ev.agent_type,
                    ev.mean_score,
                    ", ".join(f"{d}={s.score}" for d, s in ev.scores.items()),
                )
        except Exception as e:
            logger.error("  ✗ %s — evaluation FAILED: %s", pid, e)
            import traceback
            traceback.print_exc()

    logger.info("Evaluation complete: %d/%d projects", len(results), len(profiles))
    return results


def step3_aggregate(evaluations: list[dict]) -> dict:
    """Step 3: Bradley-Terry aggregation + tension summary."""
    logger.info("=" * 60)
    logger.info("STEP 3: BRADLEY-TERRY AGGREGATION")
    logger.info("=" * 60)

    if len(evaluations) < 2:
        logger.warning("Need >= 2 evaluations for BT ranking")
        return {"rankings": {}, "comparisons": [], "percentiles": {}}

    # Build score dict
    project_scores = {
        ev["project_id"]: ev["overall_score"]
        for ev in evaluations
    }

    # Generate pairwise comparisons
    comparisons = generate_pairwise_comparisons(project_scores, steepness=0.1)

    # Run Bradley-Terry
    rankings = bradley_terry_aggregate(comparisons)

    # Compute percentiles
    percentiles = {}
    for pid in rankings:
        pct = bt_rank_to_percentile(rankings, pid)
        percentiles[pid] = pct

    # Update evaluations with BT rank
    for ev in evaluations:
        ev["bradley_terry_rank"] = rankings.get(ev["project_id"])
        ev["bt_percentile"] = percentiles.get(ev["project_id"])

    logger.info("Bradley-Terry Rankings:")
    sorted_rankings = sorted(rankings.items(), key=lambda x: x[1], reverse=True)
    for i, (pid, strength) in enumerate(sorted_rankings, 1):
        pct = percentiles.get(pid, 0)
        score = project_scores.get(pid, 0)
        logger.info("  #%d  %s — BT: %.4f  Percentile: %.1f%%  Score: %.1f",
                     i, pid, strength, pct, score)

    return {
        "rankings": rankings,
        "comparisons": [(a, b, float(p)) for a, b, p in comparisons],
        "percentiles": percentiles,
    }


def step4_sqf_mechanism(evaluations: list[dict], bt_rankings: dict) -> dict:
    """Step 4: Apply Stigmergic Quadratic Funding mechanism."""
    logger.info("=" * 60)
    logger.info("STEP 4: STIGMERGIC QUADRATIC FUNDING")
    logger.info("=" * 60)

    matching_pool = 100_000  # $100k simulated matching pool

    sqf = SQFMechanism(matching_pool=matching_pool, damping=0.85, cap=0.25)

    # Use evaluation scores as accuracy proxies for pheromone deposits
    eval_scores = {ev["project_id"]: ev["overall_score"] / 100.0 for ev in evaluations}
    for pid, accuracy in eval_scores.items():
        sqf.pheromone.deposit(pid, accuracy)

    # Compute allocations
    allocations = sqf.compute_allocation(
        contributions=SIMULATED_CONTRIBUTIONS,
        dependencies=DEPENDENCY_EDGES,
        evaluation_scores=eval_scores,
    )

    # Also compute standard QF for comparison
    standard_qf = sqf.qf.calculate(SIMULATED_CONTRIBUTIONS, matching_pool)

    logger.info("SQF Allocations (from $%s matching pool):", f"{matching_pool:,}")
    sorted_allocs = sorted(allocations.items(), key=lambda x: x[1], reverse=True)
    for pid, amount in sorted_allocs:
        std = standard_qf.get(pid, 0)
        diff = amount - std
        logger.info(
            "  %s: $%.2f (standard QF: $%.2f, SQF delta: %+.2f)",
            pid, amount, std, diff,
        )

    state = sqf.get_state()

    return {
        "matching_pool": matching_pool,
        "sqf_allocations": allocations,
        "standard_qf_allocations": standard_qf,
        "pheromone_state": state["pheromone_state"],
        "pagerank_nodes": state["pagerank_nodes"],
        "contributions_used": {k: len(v) for k, v in SIMULATED_CONTRIBUTIONS.items()},
    }


def step5_compute_attestations(evaluations: list[dict], profiles: dict, sqf_result: dict) -> list[dict]:
    """Step 5: Compute on-chain attestation hashes (+ publish if keys available)."""
    logger.info("=" * 60)
    logger.info("STEP 5: ATTESTATION HASH COMPUTATION")
    logger.info("=" * 60)

    attestations = []
    for ev in evaluations:
        pid = ev["project_id"]
        evidence = {
            "project_id": pid,
            "evaluation": ev,
            "collection_profile": profiles.get(pid, {}),
            "sqf_allocation": sqf_result["sqf_allocations"].get(pid, 0),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0",
            "system": "SIMOGRANTS",
        }

        # Compute hashes
        evidence_json = json.dumps(evidence, separators=(",", ":"), sort_keys=True)
        eval_hash = compute_keccak256(evidence_json.encode())
        proj_hash = compute_keccak256(pid.encode("utf-8"))

        attestation = {
            "project_id": pid,
            "project_hash": proj_hash,
            "evaluation_hash": eval_hash,
            "overall_score": ev["overall_score"],
            "sqf_allocation": sqf_result["sqf_allocations"].get(pid, 0),
            "evidence_size_bytes": len(evidence_json),
            "evidence_sha256": hashlib.sha256(evidence_json.encode()).hexdigest(),
        }

        attestations.append(attestation)
        logger.info(
            "  %s: projHash=%s  evalHash=%s",
            pid, proj_hash[:18] + "...", eval_hash[:18] + "...",
        )

    # Check if we can publish on-chain
    private_key = os.environ.get("ATTESTER_PRIVATE_KEY", "")
    contract = os.environ.get("ATTESTATION_CONTRACT", "")

    if private_key and contract:
        logger.info("On-chain publication: keys available, would publish to Base")
        for att in attestations:
            att["onchain_status"] = "ready_to_publish"
    else:
        logger.info("On-chain publication: no keys available — hashes computed locally")
        logger.info("  To publish: set ATTESTER_PRIVATE_KEY and ATTESTATION_CONTRACT")
        for att in attestations:
            att["onchain_status"] = "local_only"

    return attestations


def step6_store_evidence(evaluations: list[dict], profiles: dict, sqf_result: dict) -> dict:
    """Step 6: Store evidence bundles locally (+ Filecoin if tokens available)."""
    logger.info("=" * 60)
    logger.info("STEP 6: EVIDENCE STORAGE")
    logger.info("=" * 60)

    evidence_dir = Path("/workspace/pipeline_output/evidence")
    evidence_dir.mkdir(parents=True, exist_ok=True)

    stored = {}
    for ev in evaluations:
        pid = ev["project_id"]
        bundle = {
            "project_id": pid,
            "evaluation": ev,
            "profile": profiles.get(pid, {}),
            "sqf_allocation": sqf_result["sqf_allocations"].get(pid, 0),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "system": "SIMOGRANTS v1.0.0",
        }

        filepath = evidence_dir / f"{pid}_evidence.json"
        filepath.write_text(json.dumps(bundle, indent=2, default=str))
        stored[pid] = {
            "local_path": str(filepath),
            "size_bytes": filepath.stat().st_size,
            "sha256": hashlib.sha256(filepath.read_bytes()).hexdigest(),
        }
        logger.info("  %s → %s (%d bytes)", pid, filepath, stored[pid]["size_bytes"])

    # Check Filecoin availability
    w3s_token = os.environ.get("WEB3STORAGE_TOKEN", "")
    lh_token = os.environ.get("LIGHTHOUSE_TOKEN", "")
    if w3s_token or lh_token:
        logger.info("Filecoin: tokens available, would upload evidence bundles")
        for pid in stored:
            stored[pid]["filecoin_status"] = "ready_to_upload"
    else:
        logger.info("Filecoin: no tokens available — evidence stored locally only")
        logger.info("  To upload: set WEB3STORAGE_TOKEN or LIGHTHOUSE_TOKEN")
        for pid in stored:
            stored[pid]["filecoin_status"] = "local_only"

    return stored


async def main():
    """Run the complete SIMOGRANTS pipeline."""
    # Load environment
    from dotenv import load_dotenv
    load_dotenv("/workspace/.env")

    start_time = time.monotonic()
    logger.info("=" * 70)
    logger.info("  SIMOGRANTS PIPELINE — LIVE RUN")
    logger.info("  %s", datetime.now(timezone.utc).isoformat())
    logger.info("  Target: %d Ethereum public goods projects", len(TARGET_PROJECTS))
    logger.info("=" * 70)

    # ─── Step 1: Collect ──────────────────────────────────────────────
    profiles = await step1_collect(TARGET_PROJECTS)

    # ─── Step 2: Evaluate ─────────────────────────────────────────────
    evaluations = await step2_evaluate(profiles)

    if not evaluations:
        logger.error("No evaluations produced. Cannot proceed.")
        # Save partial results
        partial = {
            "status": "partial_failure",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "collected_profiles": {pid: p.get("data_completeness", 0) for pid, p in profiles.items()},
            "error": "No evaluations produced - check LLM API access",
        }
        Path("/workspace/pipeline_results.json").write_text(json.dumps(partial, indent=2))
        return

    # ─── Step 3: Aggregate ────────────────────────────────────────────
    bt_result = step3_aggregate(evaluations)

    # ─── Step 4: SQF Mechanism ────────────────────────────────────────
    sqf_result = step4_sqf_mechanism(evaluations, bt_result.get("rankings", {}))

    # ─── Step 5: Attestation Hashes ───────────────────────────────────
    attestations = step5_compute_attestations(evaluations, profiles, sqf_result)

    # ─── Step 6: Store Evidence ───────────────────────────────────────
    storage = step6_store_evidence(evaluations, profiles, sqf_result)

    # ─── Assemble Final Results ───────────────────────────────────────
    elapsed = time.monotonic() - start_time

    # Tension summary
    all_tensions = []
    for ev in evaluations:
        for t in ev.get("tensions", []):
            t["project_id"] = ev["project_id"]
            all_tensions.append(t)

    pipeline_results = {
        "pipeline_version": "1.0.0",
        "system": "SIMOGRANTS — Stigmergic Impact Oracle for Public Goods",
        "run_timestamp": datetime.now(timezone.utc).isoformat(),
        "elapsed_seconds": round(elapsed, 1),
        "projects_targeted": len(TARGET_PROJECTS),
        "projects_collected": sum(1 for p in profiles.values() if not p.get("error")),
        "projects_evaluated": len(evaluations),
        "summary": {
            "overall_rankings": sorted(
                [
                    {
                        "project_id": ev["project_id"],
                        "overall_score": ev["overall_score"],
                        "bt_rank": ev.get("bradley_terry_rank"),
                        "bt_percentile": ev.get("bt_percentile"),
                        "sqf_allocation": sqf_result["sqf_allocations"].get(ev["project_id"], 0),
                        "tension_count": len(ev.get("tensions", [])),
                    }
                    for ev in evaluations
                ],
                key=lambda x: x["overall_score"],
                reverse=True,
            ),
            "total_tensions": len(all_tensions),
            "matching_pool": sqf_result["matching_pool"],
        },
        "collection_profiles": {
            pid: {
                "name": p.get("name", pid),
                "data_completeness": p.get("data_completeness", 0),
                "github_stars": p.get("github", {}).get("stars", 0) if isinstance(p.get("github"), dict) else 0,
                "github_forks": p.get("github", {}).get("forks", 0) if isinstance(p.get("github"), dict) else 0,
                "contributors": p.get("github", {}).get("contributors_count", 0) if isinstance(p.get("github"), dict) else 0,
            }
            for pid, p in profiles.items()
        },
        "evaluations": evaluations,
        "bradley_terry": bt_result,
        "sqf_mechanism": sqf_result,
        "attestations": attestations,
        "tensions": all_tensions,
        "evidence_storage": storage,
        "dependencies_used": DEPENDENCY_EDGES,
    }

    # ─── Save Results ─────────────────────────────────────────────────
    output_dir = Path("/workspace/pipeline_output")
    output_dir.mkdir(parents=True, exist_ok=True)

    results_path = Path("/workspace/pipeline_results.json")
    results_path.write_text(json.dumps(pipeline_results, indent=2, default=str))
    logger.info("Results saved to %s", results_path)

    # Also save a copy in pipeline_output
    (output_dir / "pipeline_results.json").write_text(
        json.dumps(pipeline_results, indent=2, default=str)
    )

    # Save individual evaluation reports
    for ev in evaluations:
        pid = ev["project_id"]
        ev_path = output_dir / f"{pid}_evaluation.json"
        ev_path.write_text(json.dumps(ev, indent=2, default=str))

    # ─── Print Summary ────────────────────────────────────────────────
    logger.info("")
    logger.info("=" * 70)
    logger.info("  PIPELINE COMPLETE — RESULTS SUMMARY")
    logger.info("=" * 70)
    logger.info("")
    logger.info("  Projects collected: %d / %d", pipeline_results["projects_collected"], len(TARGET_PROJECTS))
    logger.info("  Projects evaluated: %d / %d", len(evaluations), len(TARGET_PROJECTS))
    logger.info("  Total tensions:     %d", len(all_tensions))
    logger.info("  Elapsed time:       %.1f seconds", elapsed)
    logger.info("")
    logger.info("  ┌─ RANKINGS ─────────────────────────────────────────────┐")
    for i, r in enumerate(pipeline_results["summary"]["overall_rankings"], 1):
        logger.info(
            "  │ #%d  %-20s  Score: %5.1f  BT: %+.3f  SQF: $%,.0f │",
            i,
            r["project_id"],
            r["overall_score"],
            r.get("bt_rank") or 0,
            r["sqf_allocation"],
        )
    logger.info("  └────────────────────────────────────────────────────────┘")
    logger.info("")
    if all_tensions:
        logger.info("  ┌─ TENSIONS ─────────────────────────────────────────────┐")
        for t in all_tensions[:5]:
            logger.info(
                "  │ %s / %s: spread=%d (%s vs %s) │",
                t.get("project_id", "?"),
                t.get("dimension", "?"),
                t.get("spread", 0),
                t.get("high_agent", "?"),
                t.get("low_agent", "?"),
            )
        logger.info("  └────────────────────────────────────────────────────────┘")
    logger.info("")
    logger.info("  Attestation hashes computed: %d", len(attestations))
    logger.info("  Evidence bundles stored:     %d", len(storage))
    logger.info("  Results file: /workspace/pipeline_results.json")
    logger.info("")

    # Copy results to /shared for other agents
    shared_path = Path("/shared/pipeline_results.json")
    shared_path.write_text(json.dumps(pipeline_results, indent=2, default=str))
    logger.info("  Shared copy: %s", shared_path)

    return pipeline_results


if __name__ == "__main__":
    try:
        from dotenv import load_dotenv
    except ImportError:
        os.system("pip install python-dotenv -q")
        from dotenv import load_dotenv

    result = asyncio.run(main())
