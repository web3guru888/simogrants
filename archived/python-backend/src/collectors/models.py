"""
SIMOGRANTS Data Collection Models
==================================
Dataclasses representing data gathered from all 7 sources:
GitHub, Etherscan, DefiLlama, Gitcoin, Snapshot, Octant, and package registries.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CollectorStatus(str, Enum):
    """Status of an individual collector run."""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    SKIPPED = "skipped"


class ChainName(str, Enum):
    """Supported EVM chains."""
    ETHEREUM = "ethereum"
    POLYGON = "polygon"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"
    BASE = "base"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Per-source dataclasses
# ---------------------------------------------------------------------------

@dataclass
class GitHubData:
    """Data collected from GitHub."""
    repo_owner: str = ""
    repo_name: str = ""
    full_name: str = ""
    description: str = ""
    language: str = ""
    languages: Dict[str, int] = field(default_factory=dict)
    stars: int = 0
    forks: int = 0
    open_issues: int = 0
    watchers: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    pushed_at: Optional[str] = None
    default_branch: str = "main"
    license_name: str = ""
    topics: List[str] = field(default_factory=list)
    is_fork: bool = False
    is_archived: bool = False
    homepage: str = ""
    contributors_count: int = 0
    commits_count_last_year: int = 0
    recent_commits: List[Dict[str, Any]] = field(default_factory=list)
    open_prs: int = 0
    closed_prs: int = 0
    has_readme: bool = False
    has_contributing: bool = False
    has_license: bool = False
    has_code_of_conduct: bool = False
    collected_at: Optional[str] = None


@dataclass
class EtherscanData:
    """Data collected from Etherscan / block explorers."""
    address: str = ""
    chain: str = "ethereum"
    balance_wei: int = 0
    balance_eth: float = 0.0
    tx_count: int = 0
    is_contract: bool = False
    contract_name: str = ""
    contract_verified: bool = False
    token_transfers_count: int = 0
    erc20_tokens: List[Dict[str, Any]] = field(default_factory=list)
    recent_transactions: List[Dict[str, Any]] = field(default_factory=list)
    first_tx_timestamp: Optional[str] = None
    last_tx_timestamp: Optional[str] = None
    unique_senders: int = 0
    unique_receivers: int = 0
    total_gas_used: int = 0
    collected_at: Optional[str] = None


@dataclass
class DefiLlamaData:
    """Data collected from DefiLlama."""
    protocol_name: str = ""
    protocol_slug: str = ""
    category: str = ""
    chains: List[str] = field(default_factory=list)
    tvl_usd: float = 0.0
    tvl_history: List[Dict[str, Any]] = field(default_factory=list)
    change_1d: Optional[float] = None
    change_7d: Optional[float] = None
    change_30d: Optional[float] = None
    mcap: Optional[float] = None
    fdv: Optional[float] = None
    fees_24h: Optional[float] = None
    fees_7d: Optional[float] = None
    revenue_24h: Optional[float] = None
    revenue_7d: Optional[float] = None
    volume_24h: Optional[float] = None
    description: str = ""
    url: str = ""
    twitter: str = ""
    github_repos: List[str] = field(default_factory=list)
    audit_links: List[str] = field(default_factory=list)
    listed_at: Optional[int] = None
    collected_at: Optional[str] = None


@dataclass
class GitcoinData:
    """Data collected from Gitcoin Grants."""
    project_id: str = ""
    project_name: str = ""
    description: str = ""
    website: str = ""
    twitter: str = ""
    github: str = ""
    rounds_participated: List[Dict[str, Any]] = field(default_factory=list)
    total_donations_usd: float = 0.0
    total_donors: int = 0
    unique_donors: int = 0
    matching_amount_usd: float = 0.0
    total_rounds: int = 0
    last_active_round: str = ""
    tags: List[str] = field(default_factory=list)
    collected_at: Optional[str] = None


@dataclass
class SnapshotData:
    """Data collected from Snapshot governance."""
    space_id: str = ""
    space_name: str = ""
    network: str = ""
    symbol: str = ""
    members_count: int = 0
    proposals_count: int = 0
    followers_count: int = 0
    voting_power_symbol: str = ""
    strategies: List[Dict[str, Any]] = field(default_factory=list)
    recent_proposals: List[Dict[str, Any]] = field(default_factory=list)
    avg_voter_turnout: float = 0.0
    avg_votes_per_proposal: float = 0.0
    categories: List[str] = field(default_factory=list)
    website: str = ""
    collected_at: Optional[str] = None


@dataclass
class OctantData:
    """Data collected from Octant."""
    project_name: str = ""
    project_address: str = ""
    epochs_participated: List[int] = field(default_factory=list)
    total_allocated_glm: float = 0.0
    total_matched_usd: float = 0.0
    donors_count: int = 0
    unique_donors: int = 0
    allocation_history: List[Dict[str, Any]] = field(default_factory=list)
    description: str = ""
    website: str = ""
    collected_at: Optional[str] = None


@dataclass
class PackageData:
    """Data collected from package registries (npm / PyPI / crates.io)."""
    registry: str = ""          # "npm", "pypi", or "crates"
    package_name: str = ""
    version: str = ""
    description: str = ""
    weekly_downloads: int = 0
    monthly_downloads: int = 0
    total_downloads: int = 0
    dependents_count: int = 0
    dependencies: List[str] = field(default_factory=list)
    license_name: str = ""
    homepage: str = ""
    repository_url: str = ""
    first_published: Optional[str] = None
    last_published: Optional[str] = None
    maintainers: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    collected_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Collection metadata
# ---------------------------------------------------------------------------

@dataclass
class CollectionMeta:
    """Metadata about an individual collector execution."""
    source: str = ""
    status: CollectorStatus = CollectorStatus.SKIPPED
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: float = 0.0
    error_message: str = ""
    retries: int = 0


# ---------------------------------------------------------------------------
# Aggregate profile
# ---------------------------------------------------------------------------

@dataclass
class ProjectProfile:
    """
    Unified project profile aggregating data from all 7 sources.

    Attributes:
        project_id: A stable identifier for the project.
        name: Human-readable project name.
        github: GitHub-sourced data.
        etherscan: Etherscan-sourced data.
        defillama: DefiLlama-sourced data.
        gitcoin: Gitcoin-sourced data.
        snapshot: Snapshot-sourced data.
        octant: Octant-sourced data.
        packages: List of package-registry data (can be multi-registry).
        collection_metadata: Per-source collection metadata.
        data_completeness: 0.0–1.0 score based on how many sources succeeded.
        collected_at: ISO-8601 timestamp of when the profile was assembled.
    """
    project_id: str = ""
    name: str = ""

    # Per-source data
    github: Optional[GitHubData] = None
    etherscan: Optional[EtherscanData] = None
    defillama: Optional[DefiLlamaData] = None
    gitcoin: Optional[GitcoinData] = None
    snapshot: Optional[SnapshotData] = None
    octant: Optional[OctantData] = None
    packages: List[PackageData] = field(default_factory=list)

    # Metadata
    collection_metadata: List[CollectionMeta] = field(default_factory=list)
    data_completeness: float = 0.0
    collected_at: Optional[str] = None

    def compute_completeness(self) -> float:
        """
        Compute and store a data_completeness score from 0.0 to 1.0.

        The score is the fraction of the 7 possible source slots that
        returned a SUCCESS or PARTIAL status.
        """
        total_sources = 7
        succeeded = 0
        for meta in self.collection_metadata:
            if meta.status in (CollectorStatus.SUCCESS, CollectorStatus.PARTIAL):
                succeeded += 1
        self.data_completeness = round(succeeded / total_sources, 4) if total_sources else 0.0
        return self.data_completeness

    def summary(self) -> Dict[str, Any]:
        """Return a human-readable summary dict."""
        return {
            "project_id": self.project_id,
            "name": self.name,
            "data_completeness": self.data_completeness,
            "sources_ok": [
                m.source for m in self.collection_metadata
                if m.status in (CollectorStatus.SUCCESS, CollectorStatus.PARTIAL)
            ],
            "sources_failed": [
                m.source for m in self.collection_metadata
                if m.status == CollectorStatus.FAILED
            ],
            "collected_at": self.collected_at,
        }
