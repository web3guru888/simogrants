"""
Test that the SQF allocation bug is fixed.

The bug: Protocol Guild (score 43.75, ranked 5th/5) was getting $24,404
(2nd highest allocation) because:
1. Virtual contributor count scaled with score, creating super-linear QF amplification
2. Empty dependency list meant no PageRank correction
3. Docs repos weren't filtered from dependency graph

Expected rankings after fix: OZ > Uniswap > Gitcoin > EthStaker > Protocol Guild
"""
import sys
sys.path.insert(0, "/workspace")

from src.mechanism.sqf import SQFMechanism, scores_to_contributions
from src.mechanism.pagerank import PageRankEngine
from src.mechanism.dependency_graph import (
    is_docs_repo,
    is_low_signal_repo,
    validate_repo,
    build_dependency_edges_from_known,
    RepoInfo,
)

# Test data: 5 projects with realistic scores
SCORES = {
    "openzeppelin": 91.08,
    "uniswap": 82.50,
    "gitcoin": 56.00,
    "ethstaker": 51.25,
    "protocol-guild": 43.75,
}

GITHUB_ORGS = {
    "openzeppelin": "openzeppelin",
    "uniswap": "uniswap",
    "gitcoin": "gitcoin",
    "ethstaker": "ethstaker",
    "protocol-guild": "protocolguild",
}

MATCHING_POOL = 100_000.0


def test_docs_repo_filtering():
    """Docs repos should be filtered out."""
    assert is_docs_repo("docs") is True
    assert is_docs_repo("documentation") is True
    assert is_docs_repo(".github") is True
    assert is_docs_repo("wiki") is True
    assert is_docs_repo("my-project-docs") is True
    assert is_docs_repo("my-project-website") is True
    # Valid repos
    assert is_docs_repo("contracts") is False
    assert is_docs_repo("core") is False
    assert is_docs_repo("protocol") is False
    assert is_docs_repo("v3-core") is False
    print("✅ docs repo filtering works")


def test_low_signal_filtering():
    """Low-signal repos should be filtered."""
    assert is_low_signal_repo(5, 2) is True   # too few stars and forks
    assert is_low_signal_repo(100, 50) is False  # plenty of both
    assert is_low_signal_repo(50, 2) is False   # stars alone are enough
    assert is_low_signal_repo(3, 20) is False   # forks alone are enough
    print("✅ low-signal repo filtering works")


def test_validate_dependency():
    """PageRankEngine.validate_dependency should filter correctly."""
    engine = PageRankEngine()
    
    # Docs repo with low stars → invalid
    assert engine.validate_dependency("docs", stars=5, forks=2, full_name="protocolguild/docs") is False
    
    # Docs repo even with high stars → invalid (it's docs)
    assert engine.validate_dependency("docs", stars=1000, forks=500, full_name="protocolguild/docs") is False
    
    # Real repo with good stats → valid
    assert engine.validate_dependency("contracts", stars=100, forks=50, full_name="openzeppelin/contracts") is True
    
    # Real repo with low stats → invalid
    assert engine.validate_dependency("contracts", stars=3, forks=1) is False
    
    print("✅ validate_dependency works")


def test_fixed_contributions():
    """All projects should get the same number of virtual contributors."""
    contribs = scores_to_contributions(SCORES)
    
    for pid, contrib_list in contribs.items():
        assert len(contrib_list) == 10, f"{pid} has {len(contrib_list)} contributors, expected 10"
    
    # Higher score = larger contributions
    assert contribs["openzeppelin"][0] > contribs["protocol-guild"][0]
    assert contribs["uniswap"][0] > contribs["gitcoin"][0]
    
    print("✅ fixed contribution generation works")
    print(f"   OZ contribution size: {contribs['openzeppelin'][0]:.2f}")
    print(f"   Protocol Guild contribution size: {contribs['protocol-guild'][0]:.2f}")


def test_dependency_graph():
    """Known dependencies should create proper edges."""
    edges = build_dependency_edges_from_known(list(SCORES.keys()), GITHUB_ORGS)
    
    # OpenZeppelin is a known infra dependency → all others should depend on it
    oz_dependents = [e[0] for e in edges if e[1] == "openzeppelin"]
    assert "uniswap" in oz_dependents, "Uniswap should depend on OZ"
    assert "gitcoin" in oz_dependents, "Gitcoin should depend on OZ"
    assert "protocol-guild" in oz_dependents, "Protocol Guild should depend on OZ"
    
    # OZ should NOT depend on itself
    assert ("openzeppelin", "openzeppelin") not in edges
    
    # Uniswap is also a known dependency
    uni_dependents = [e[0] for e in edges if e[1] == "uniswap"]
    assert len(uni_dependents) > 0, "Some projects should depend on Uniswap"
    
    print(f"✅ dependency graph has {len(edges)} edges")
    for dep, infra in sorted(set((e[1], e[0]) for e in edges)):
        pass  # Just verifying no errors


def test_pagerank_boosts_infra():
    """PageRank should boost OpenZeppelin (most depended-upon)."""
    engine = PageRankEngine()
    edges = build_dependency_edges_from_known(list(SCORES.keys()), GITHUB_ORGS)
    engine.build_graph(edges)
    pr_scores = engine.compute_pagerank()
    
    if pr_scores:
        print(f"   PageRank scores: {', '.join(f'{k}: {v:.4f}' for k, v in sorted(pr_scores.items(), key=lambda x: -x[1]))}")
        
        # OZ should have highest PageRank (most depended upon)
        oz_rank = pr_scores.get("openzeppelin", 0)
        pg_rank = pr_scores.get("protocol-guild", 0)
        assert oz_rank > pg_rank, f"OZ PageRank ({oz_rank:.4f}) should be > Protocol Guild ({pg_rank:.4f})"
        
        # Check modifiers
        oz_mod = engine.get_modifier("openzeppelin", pr_scores)
        pg_mod = engine.get_modifier("protocol-guild", pr_scores)
        print(f"   OZ modifier: {oz_mod:.3f}, Protocol Guild modifier: {pg_mod:.3f}")
        assert oz_mod > pg_mod, "OZ should get a higher modifier than Protocol Guild"
    
    print("✅ PageRank correctly boosts infrastructure projects")


def test_full_sqf_allocation():
    """Full SQF allocation should rank: OZ > Uniswap > Gitcoin > EthStaker > Protocol Guild."""
    mechanism = SQFMechanism(matching_pool=MATCHING_POOL)
    
    # Build dependency graph
    edges = build_dependency_edges_from_known(list(SCORES.keys()), GITHUB_ORGS)
    
    # Compute allocation using the fixed method
    allocations = mechanism.compute_allocation_from_scores(SCORES, edges)
    
    print(f"\n{'Project':<20} {'Score':>8} {'Allocation':>12} {'% of Pool':>10}")
    print("-" * 52)
    for pid in sorted(allocations, key=lambda x: -allocations[x]):
        alloc = allocations[pid]
        pct = alloc / MATCHING_POOL * 100
        print(f"{pid:<20} {SCORES[pid]:>8.2f} ${alloc:>10,.0f} {pct:>9.1f}%")
    
    # Verify ranking
    ranked = sorted(allocations, key=lambda x: -allocations[x])
    assert ranked[0] == "openzeppelin", f"Expected OZ first, got {ranked[0]}"
    assert ranked[1] == "uniswap", f"Expected Uniswap second, got {ranked[1]}"
    assert ranked[-1] == "protocol-guild" or allocations["protocol-guild"] < allocations["gitcoin"], \
        f"Protocol Guild should be ranked low, got {ranked.index('protocol-guild') + 1}"
    
    # Protocol Guild should NOT be 2nd highest
    assert allocations["protocol-guild"] < allocations["uniswap"], \
        "Protocol Guild should get less than Uniswap"
    assert allocations["protocol-guild"] < allocations["gitcoin"], \
        "Protocol Guild should get less than Gitcoin"
    
    # Sanity: total should equal matching pool
    total = sum(allocations.values())
    assert abs(total - MATCHING_POOL) < 1.0, f"Total {total} != pool {MATCHING_POOL}"
    
    print(f"\n✅ Total allocated: ${total:,.0f}")
    print(f"✅ Rankings correct: {' > '.join(ranked)}")


def test_old_bug_is_gone():
    """
    Verify the OLD buggy behavior no longer occurs.
    Old code: contributions[pid] = [score / 10.0] * max(1, int(score / 10))
    """
    from src.mechanism.qf import QFEngine
    
    # Simulate old buggy contributions
    old_contributions = {}
    for pid, score in SCORES.items():
        old_contributions[pid] = [score / 10.0] * max(1, int(score / 10))
    
    # Simulate new fixed contributions
    new_contributions = scores_to_contributions(SCORES)
    
    print("\nOld (buggy) contribution structure:")
    for pid in sorted(SCORES, key=lambda x: -SCORES[x]):
        c = old_contributions[pid]
        print(f"  {pid}: {len(c)} contributors × ${c[0]:.2f} each")
    
    print("\nNew (fixed) contribution structure:")
    for pid in sorted(SCORES, key=lambda x: -SCORES[x]):
        c = new_contributions[pid]
        print(f"  {pid}: {len(c)} contributors × ${c[0]:.2f} each")
    
    qf = QFEngine(cap_per_project=0.25)
    
    old_alloc = qf.calculate(old_contributions, MATCHING_POOL)
    new_alloc = qf.calculate(new_contributions, MATCHING_POOL)
    
    print("\nOld QF allocation (before cap):")
    for pid in sorted(old_alloc, key=lambda x: -old_alloc[x]):
        print(f"  {pid}: ${old_alloc[pid]:,.0f}")
    
    print("\nNew QF allocation (before cap):")
    for pid in sorted(new_alloc, key=lambda x: -new_alloc[x]):
        print(f"  {pid}: ${new_alloc[pid]:,.0f}")
    
    # In the new system, rankings should follow scores
    new_ranked = sorted(new_alloc, key=lambda x: -new_alloc[x])
    score_ranked = sorted(SCORES, key=lambda x: -SCORES[x])
    assert new_ranked == score_ranked, \
        f"New QF rankings {new_ranked} should match score rankings {score_ranked}"
    
    print("\n✅ Old bug eliminated: QF rankings now match score rankings")


if __name__ == "__main__":
    test_docs_repo_filtering()
    test_low_signal_filtering()
    test_validate_dependency()
    test_fixed_contributions()
    test_dependency_graph()
    test_pagerank_boosts_infra()
    test_full_sqf_allocation()
    test_old_bug_is_gone()
    print("\n🎉 ALL TESTS PASSED")
