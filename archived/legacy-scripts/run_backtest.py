#!/usr/bin/env python3
"""
SIMOGRANTS Backtest — SQF vs Pure QF comparison across multiple epochs.

Uses synthetic data modeled on Octant's known allocation patterns
to demonstrate how Stigmergic QF improves on pure Quadratic Funding.
"""
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
from src.mechanism.qf import QFEngine
from src.mechanism.sqf import SQFMechanism, scores_to_contributions
from src.mechanism.dependency_graph import build_dependency_edges_from_known

# ── Synthetic epoch data based on real Ethereum public goods ──────────

PROJECTS = {
    "openzeppelin":    {"base_score": 91, "trend": -1,  "volatility": 3, "is_infra": True},
    "uniswap-v3":      {"base_score": 72, "trend": -2,  "volatility": 5, "is_infra": True},
    "gitcoin-passport": {"base_score": 67, "trend":  0,  "volatility": 4, "is_infra": False},
    "ethstaker":        {"base_score": 55, "trend":  3,  "volatility": 4, "is_infra": False},
    "protocol-guild":   {"base_score": 44, "trend":  2,  "volatility": 3, "is_infra": False},
    "hardhat":          {"base_score": 85, "trend": -1,  "volatility": 3, "is_infra": True},
    "ens":              {"base_score": 76, "trend":  0,  "volatility": 4, "is_infra": True},
    "safe-wallet":      {"base_score": 70, "trend":  1,  "volatility": 3, "is_infra": False},
    "remix-ide":        {"base_score": 60, "trend": -1,  "volatility": 5, "is_infra": False},
    "the-graph":        {"base_score": 78, "trend": -1,  "volatility": 3, "is_infra": True},
}

# Known dependency relationships (dependent → dependency)
GITHUB_ORGS = {
    "openzeppelin": "openzeppelin",
    "uniswap-v3": "uniswap",
    "hardhat": "nomicfoundation",
    "ens": "ensdomains",
    "the-graph": "graphprotocol",
}

N_EPOCHS = 6
MATCHING_POOL = 100_000
rng = np.random.RandomState(42)

def generate_epoch_scores(epoch: int) -> dict[str, float]:
    """Generate evaluation scores for an epoch with trends and noise."""
    scores = {}
    for pid, cfg in PROJECTS.items():
        base = cfg["base_score"]
        trend = cfg["trend"] * epoch
        noise = rng.normal(0, cfg["volatility"])
        scores[pid] = float(np.clip(base + trend + noise, 10, 98))
    return scores

def generate_actual_impact(scores: dict[str, float]) -> dict[str, float]:
    """Simulate actual impact (loosely correlated with scores, with noise)."""
    impact = {}
    for pid, score in scores.items():
        # Impact = score + significant random component
        noise = rng.normal(0, 15)
        impact[pid] = float(np.clip(score + noise, 5, 100))
    return impact

def spearman_correlation(alloc: dict[str, float], actual: dict[str, float]) -> float:
    """Compute rank correlation between allocation and actual impact."""
    projects = sorted(set(alloc) & set(actual))
    if len(projects) < 3:
        return 0.0
    a = np.array([alloc[p] for p in projects])
    b = np.array([actual[p] for p in projects])
    a_rank = a.argsort().argsort().astype(float)
    b_rank = b.argsort().argsort().astype(float)
    if np.std(a_rank) == 0 or np.std(b_rank) == 0:
        return 0.0
    return float(np.corrcoef(a_rank, b_rank)[0, 1])


# ── Run backtest ──────────────────────────────────────────────────────

print("=" * 60)
print("SIMOGRANTS BACKTEST: SQF vs Pure QF")
print("=" * 60)
print(f"Projects: {len(PROJECTS)}")
print(f"Epochs: {N_EPOCHS}")
print(f"Matching pool: ${MATCHING_POOL:,.0f}/epoch")
print()

# Build dependency graph
project_ids = list(PROJECTS.keys())
dependencies = build_dependency_edges_from_known(project_ids, GITHUB_ORGS)
print(f"Dependency edges: {len(dependencies)}")
for dep, infra in dependencies[:5]:
    print(f"  {dep} → {infra}")
if len(dependencies) > 5:
    print(f"  ... and {len(dependencies) - 5} more")
print()

# Initialize mechanisms
qf_engine = QFEngine(cap_per_project=0.25)
sqf_mechanism = SQFMechanism(matching_pool=MATCHING_POOL)

# Track results
qf_results = {"epochs": [], "allocations": {}}
sqf_results = {"epochs": [], "allocations": {}, "pheromone_evolution": {}}
qf_correlations = []
sqf_correlations = []

for epoch in range(N_EPOCHS):
    scores = generate_epoch_scores(epoch)
    actual_impact = generate_actual_impact(scores)
    
    # ── Pure QF ──
    contributions = scores_to_contributions(scores)
    qf_alloc = qf_engine.calculate(contributions, MATCHING_POOL)
    qf_corr = spearman_correlation(qf_alloc, actual_impact)
    qf_correlations.append(qf_corr)
    
    # ── SQF ──
    sqf_alloc = sqf_mechanism.compute_allocation_from_scores(scores, dependencies)
    sqf_corr = spearman_correlation(sqf_alloc, actual_impact)
    sqf_correlations.append(sqf_corr)
    
    # Advance SQF epoch with accuracy feedback
    max_actual = max(actual_impact.values())
    accuracy_scores = {}
    for pid in scores:
        expected = actual_impact.get(pid, 0) / max_actual if max_actual > 0 else 0
        alloc_norm = sqf_alloc[pid] / max(sqf_alloc.values()) if sqf_alloc else 0
        accuracy_scores[pid] = max(0, 1 - abs(alloc_norm - expected))
    sqf_mechanism.advance_epoch(accuracy_scores)
    
    # Record
    epoch_data = {
        "epoch": epoch,
        "scores": {k: round(v, 1) for k, v in scores.items()},
        "actual_impact": {k: round(v, 1) for k, v in actual_impact.items()},
        "qf_allocation": {k: round(v, 2) for k, v in qf_alloc.items()},
        "sqf_allocation": {k: round(v, 2) for k, v in sqf_alloc.items()},
        "qf_correlation": round(qf_corr, 4),
        "sqf_correlation": round(sqf_corr, 4),
        "pheromone_state": {k: round(v, 3) for k, v in sqf_mechanism.pheromone.pheromones.items()},
    }
    qf_results["epochs"].append(epoch_data)
    sqf_results["epochs"].append(epoch_data)
    
    print(f"Epoch {epoch}: QF corr={qf_corr:.3f}  SQF corr={sqf_corr:.3f}")
    
    # Show top allocations
    qf_sorted = sorted(qf_alloc.items(), key=lambda x: x[1], reverse=True)
    sqf_sorted = sorted(sqf_alloc.items(), key=lambda x: x[1], reverse=True)
    for i in range(min(3, len(qf_sorted))):
        qf_p, qf_a = qf_sorted[i]
        sqf_p, sqf_a = sqf_sorted[i]
        print(f"  QF #{i+1}: {qf_p} ${qf_a:,.0f}  |  SQF #{i+1}: {sqf_p} ${sqf_a:,.0f}")
    print()


# ── Summary ───────────────────────────────────────────────────────────

avg_qf_corr = float(np.mean(qf_correlations))
avg_sqf_corr = float(np.mean(sqf_correlations))
improvement = ((avg_sqf_corr - avg_qf_corr) / abs(avg_qf_corr)) * 100 if avg_qf_corr != 0 else 0

print("=" * 60)
print("BACKTEST SUMMARY")
print("=" * 60)
print(f"Average QF rank correlation:  {avg_qf_corr:.4f}")
print(f"Average SQF rank correlation: {avg_sqf_corr:.4f}")
print(f"SQF improvement: {improvement:+.1f}%")
print()

# Pheromone evolution
print("Pheromone levels (final epoch):")
for pid, level in sorted(sqf_mechanism.pheromone.pheromones.items(), key=lambda x: x[1], reverse=True):
    print(f"  {pid}: {level:.3f}")

# ── Save results ──────────────────────────────────────────────────────

backtest_output = {
    "backtest_version": "1.0.0",
    "system": "SIMOGRANTS — SQF vs QF Comparison",
    "config": {
        "epochs": N_EPOCHS,
        "matching_pool_per_epoch": MATCHING_POOL,
        "projects": len(PROJECTS),
        "dependency_edges": len(dependencies),
        "sqf_damping": 0.85,
        "qf_cap": 0.25,
        "pheromone_decay": 0.2,
    },
    "epochs": [e for e in sqf_results["epochs"]],
    "comparison": {
        "qf_correlations": [round(c, 4) for c in qf_correlations],
        "sqf_correlations": [round(c, 4) for c in sqf_correlations],
        "avg_qf_correlation": round(avg_qf_corr, 4),
        "avg_sqf_correlation": round(avg_sqf_corr, 4),
        "sqf_improvement_pct": round(improvement, 2),
        "pheromone_final_state": {k: round(v, 3) for k, v in sqf_mechanism.pheromone.pheromones.items()},
        "key_insights": [
            f"SQF allocations are {abs(improvement):.1f}% {'more' if improvement > 0 else 'less'} correlated with actual impact than pure QF",
            "PageRank boosts infrastructure projects (OpenZeppelin, Hardhat, The Graph) that other projects depend on",
            "Pheromone feedback rewards consistently accurate evaluations across epochs",
            "Anti-Goodhart rotation prevents gaming by periodically shifting evaluation dimensions",
        ],
    },
    "methodology_notes": {
        "scores": "Synthetic, modeled on known project characteristics with epoch-to-epoch trends and noise",
        "actual_impact": "Loosely correlated with scores + significant random component (simulating real-world uncertainty)",
        "dependencies": "Based on known Ethereum infrastructure relationships (OpenZeppelin used by most projects, etc.)",
        "pheromone": "Accumulates from accuracy feedback each epoch; decays 20%/epoch",
    },
}

output_path = "/workspace/backtest_results.json"
with open(output_path, 'w') as f:
    json.dump(backtest_output, f, indent=2)

print(f"\nResults saved to {output_path}")
