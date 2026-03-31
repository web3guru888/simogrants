"""
SIMOGRANTS Collectors Package
==============================
Async data collectors for Ethereum public goods project analysis.

Quick usage::

    from collectors import CollectionOrchestrator, collect_project

    profile = await collect_project(
        identifiers={"github": "uniswap/v3-core", "defillama": "uniswap"},
        project_id="uniswap",
    )
"""

# Models
from .models import (
    ChainName,
    CollectionMeta,
    CollectorStatus,
    DefiLlamaData,
    EtherscanData,
    GitcoinData,
    GitHubData,
    OctantData,
    PackageData,
    ProjectProfile,
    SnapshotData,
)

# Base
from .base import BaseCollector

# Collectors
from .github import GitHubCollector
from .etherscan import EtherscanCollector
from .defillama import DefiLlamaCollector
from .gitcoin import GitcoinCollector
from .snapshot import SnapshotCollector
from .octant import OctantCollector
from .packages import PackagesCollector

# Orchestrator
from .orchestrator import CollectionOrchestrator, collect_project

__all__ = [
    # Models
    "ChainName",
    "CollectionMeta",
    "CollectorStatus",
    "DefiLlamaData",
    "EtherscanData",
    "GitcoinData",
    "GitHubData",
    "OctantData",
    "PackageData",
    "ProjectProfile",
    "SnapshotData",
    # Base
    "BaseCollector",
    # Collectors
    "GitHubCollector",
    "EtherscanCollector",
    "DefiLlamaCollector",
    "GitcoinCollector",
    "SnapshotCollector",
    "OctantCollector",
    "PackagesCollector",
    # Orchestrator
    "CollectionOrchestrator",
    "collect_project",
]
