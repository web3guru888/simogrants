"""
SIMOGRANTS Collection Orchestrator
====================================
Runs all 7 collectors in parallel via ``asyncio.gather`` and assembles the
results into a unified :class:`ProjectProfile`.

Usage::

    from collectors.orchestrator import CollectionOrchestrator

    orch = CollectionOrchestrator(identifiers={
        "github": "ethereum/go-ethereum",
        "etherscan": "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
        "defillama": "lido",
        "snapshot": "lido-snapshot.eth",
    })
    profile = await orch.run()
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type

from .base import BaseCollector
from .models import (
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

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Registry of source name → (CollectorClass, DataClass)
# ---------------------------------------------------------------------------

def _build_registry() -> Dict[str, tuple]:
    """
    Lazy import to avoid circular dependencies and to tolerate missing
    collector modules during testing.
    """
    registry: Dict[str, tuple] = {}
    try:
        from .github import GitHubCollector
        registry["github"] = (GitHubCollector, GitHubData)
    except ImportError:
        logger.warning("GitHubCollector not available")
    try:
        from .etherscan import EtherscanCollector
        registry["etherscan"] = (EtherscanCollector, EtherscanData)
    except ImportError:
        logger.warning("EtherscanCollector not available")
    try:
        from .defillama import DefiLlamaCollector
        registry["defillama"] = (DefiLlamaCollector, DefiLlamaData)
    except ImportError:
        logger.warning("DefiLlamaCollector not available")
    try:
        from .gitcoin import GitcoinCollector
        registry["gitcoin"] = (GitcoinCollector, GitcoinData)
    except ImportError:
        logger.warning("GitcoinCollector not available")
    try:
        from .snapshot import SnapshotCollector
        registry["snapshot"] = (SnapshotCollector, SnapshotData)
    except ImportError:
        logger.warning("SnapshotCollector not available")
    try:
        from .octant import OctantCollector
        registry["octant"] = (OctantCollector, OctantData)
    except ImportError:
        logger.warning("OctantCollector not available")
    try:
        from .packages import PackagesCollector
        registry["packages"] = (PackagesCollector, PackageData)
    except ImportError:
        logger.warning("PackagesCollector not available")
    return registry


class CollectionOrchestrator:
    """
    Fan-out orchestrator that runs collectors in parallel and merges results.

    Parameters
    ----------
    identifiers:
        Mapping of source name → lookup identifier.
        Only sources present in this dict will be queried.
    project_id:
        Stable identifier stored in the resulting :class:`ProjectProfile`.
    project_name:
        Human-readable name stored in the profile.
    api_keys:
        Optional mapping of source name → API key string.
    collector_kwargs:
        Optional per-source keyword arguments passed to the collector
        constructor (e.g. ``{"github": {"timeout": 45}}``)
    """

    def __init__(
        self,
        identifiers: Dict[str, str],
        *,
        project_id: str = "",
        project_name: str = "",
        api_keys: Optional[Dict[str, str]] = None,
        collector_kwargs: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> None:
        self.identifiers = identifiers
        self.project_id = project_id
        self.project_name = project_name
        self.api_keys = api_keys or {}
        self.collector_kwargs = collector_kwargs or {}
        self._collectors: List[BaseCollector] = []

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _instantiate_collectors(
        self,
    ) -> List[tuple]:
        """
        Build (source_name, collector_instance, identifier, DataClass) tuples
        for every source that has an identifier.
        """
        registry = _build_registry()
        items = []
        for source_name, ident in self.identifiers.items():
            if source_name not in registry:
                logger.warning("No collector registered for source '%s'", source_name)
                continue
            cls, data_cls = registry[source_name]
            kwargs = dict(self.collector_kwargs.get(source_name, {}))
            if source_name in self.api_keys:
                kwargs["api_key"] = self.api_keys[source_name]
            collector = cls(**kwargs)
            self._collectors.append(collector)
            items.append((source_name, collector, ident, data_cls))
        return items

    @staticmethod
    def _build_dataclass(data_cls: type, raw: Dict[str, Any]) -> Any:
        """Safely construct a dataclass from a raw dict."""
        valid_fields = set(data_cls.__dataclass_fields__.keys())
        filtered = {k: v for k, v in raw.items() if k in valid_fields}
        return data_cls(**filtered)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run(self) -> ProjectProfile:
        """
        Execute all configured collectors in parallel and return a
        :class:`ProjectProfile`.
        """
        items = self._instantiate_collectors()
        if not items:
            logger.warning("No collectors to run — returning empty profile.")
            return ProjectProfile(
                project_id=self.project_id,
                name=self.project_name,
                collected_at=datetime.now(timezone.utc).isoformat(),
            )

        # Fire all collectors concurrently
        async def _run_one(source_name: str, collector: BaseCollector, ident: str):
            return source_name, await collector.collect(ident)

        tasks = [
            asyncio.create_task(_run_one(sn, col, ident))
            for sn, col, ident, _ in items
        ]

        results_raw = await asyncio.gather(*tasks, return_exceptions=True)

        # Build the profile
        profile = ProjectProfile(
            project_id=self.project_id,
            name=self.project_name,
        )

        data_cls_map = {sn: dcls for sn, _, _, dcls in items}

        for result in results_raw:
            if isinstance(result, Exception):
                logger.error("Collector task raised: %s", result)
                profile.collection_metadata.append(
                    CollectionMeta(
                        source="unknown",
                        status=CollectorStatus.FAILED,
                        error_message=str(result),
                    )
                )
                continue

            source_name, outcome = result
            meta: CollectionMeta = outcome["meta"]
            data: Dict[str, Any] = outcome.get("data", {})
            profile.collection_metadata.append(meta)

            if meta.status == CollectorStatus.FAILED or not data:
                continue

            # Map source → profile attribute
            data_cls = data_cls_map.get(source_name)
            if data_cls is None:
                continue

            typed = self._build_dataclass(data_cls, data)

            if source_name == "github":
                profile.github = typed
                if not profile.name and hasattr(typed, "full_name"):
                    profile.name = typed.full_name
            elif source_name == "etherscan":
                profile.etherscan = typed
            elif source_name == "defillama":
                profile.defillama = typed
                if not profile.name and hasattr(typed, "protocol_name"):
                    profile.name = typed.protocol_name
            elif source_name == "gitcoin":
                profile.gitcoin = typed
            elif source_name == "snapshot":
                profile.snapshot = typed
            elif source_name == "octant":
                profile.octant = typed
            elif source_name == "packages":
                if isinstance(typed, list):
                    profile.packages.extend(typed)
                else:
                    profile.packages.append(typed)

        # Finalize
        profile.collected_at = datetime.now(timezone.utc).isoformat()
        profile.compute_completeness()

        # Cleanup clients
        for collector in self._collectors:
            try:
                await collector.close()
            except Exception:
                pass

        logger.info(
            "Collection complete for '%s': completeness=%.2f  sources_ok=%d/%d",
            profile.project_id or profile.name,
            profile.data_completeness,
            sum(
                1 for m in profile.collection_metadata
                if m.status in (CollectorStatus.SUCCESS, CollectorStatus.PARTIAL)
            ),
            len(profile.collection_metadata),
        )
        return profile


# ---------------------------------------------------------------------------
# Convenience function
# ---------------------------------------------------------------------------

async def collect_project(
    identifiers: Dict[str, str],
    *,
    project_id: str = "",
    project_name: str = "",
    api_keys: Optional[Dict[str, str]] = None,
) -> ProjectProfile:
    """
    One-shot helper: build an orchestrator, run it, return the profile.

    Example::

        profile = await collect_project(
            identifiers={"github": "uniswap/v3-core", "defillama": "uniswap"},
            project_id="uniswap",
        )
    """
    orch = CollectionOrchestrator(
        identifiers=identifiers,
        project_id=project_id,
        project_name=project_name,
        api_keys=api_keys,
    )
    return await orch.run()
