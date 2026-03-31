"""
SIMOGRANTS DefiLlama Collector
===============================
Gathers TVL, protocol metadata, fee/revenue data, and volume from the
DefiLlama public API (no API key required).

Identifier format: the protocol **slug** as it appears on DefiLlama,
e.g. ``"uniswap"``, ``"aave"``, ``"lido"``.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .base import BaseCollector
from .models import DefiLlamaData

logger = logging.getLogger(__name__)

LLAMA_API = "https://api.llama.fi"
LLAMA_FEES_API = "https://api.llama.fi"
LLAMA_VOLUMES_API = "https://api.llama.fi"


class DefiLlamaCollector(BaseCollector):
    """Collector for DefiLlama protocol data."""

    source_name: str = "defillama"

    def __init__(
        self,
        *,
        timeout: float = 30.0,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> None:
        super().__init__(timeout=timeout, max_retries=max_retries, **kwargs)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_protocol(self, slug: str) -> Dict[str, Any]:
        """Fetch the full protocol object (includes TVL history)."""
        url = f"{LLAMA_API}/protocol/{slug}"
        return await self._get_json(url)

    async def _fetch_protocols_list(self) -> List[Dict[str, Any]]:
        """Fetch the summary list of all protocols (includes current TVL)."""
        url = f"{LLAMA_API}/protocols"
        return await self._get_json(url)

    async def _fetch_fees(self, slug: str) -> Dict[str, Any]:
        """Fetch fee/revenue summary for a protocol."""
        url = f"{LLAMA_FEES_API}/summary/fees/{slug}"
        try:
            return await self._get_json(url)
        except Exception:
            logger.debug("[defillama] fees endpoint unavailable for %s", slug)
            return {}

    async def _fetch_volume(self, slug: str) -> Dict[str, Any]:
        """Fetch DEX volume summary for a protocol."""
        url = f"{LLAMA_VOLUMES_API}/summary/dexs/{slug}"
        try:
            return await self._get_json(url)
        except Exception:
            logger.debug("[defillama] volume endpoint unavailable for %s", slug)
            return {}

    @staticmethod
    def _extract_tvl_history(
        protocol_data: Dict[str, Any], max_points: int = 90
    ) -> List[Dict[str, Any]]:
        """Extract the last *max_points* daily TVL snapshots."""
        tvl_raw = protocol_data.get("tvl", [])
        if not isinstance(tvl_raw, list):
            return []
        recent = tvl_raw[-max_points:] if len(tvl_raw) > max_points else tvl_raw
        return [
            {"date": pt.get("date"), "tvl": pt.get("totalLiquidityUSD", 0)}
            for pt in recent
            if isinstance(pt, dict)
        ]

    @staticmethod
    def _find_in_protocols_list(
        slug: str, protocols: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Find a protocol entry in the summary list by slug."""
        slug_lower = slug.lower()
        for p in protocols:
            if p.get("slug", "").lower() == slug_lower:
                return p
        return None

    # ------------------------------------------------------------------
    # Main collection implementation
    # ------------------------------------------------------------------

    async def _collect_impl(self, identifier: str) -> Dict[str, Any]:
        """
        Collect DefiLlama data for a protocol slug.

        Parameters
        ----------
        identifier:
            Protocol slug, e.g. ``"aave"``.

        Returns
        -------
        dict suitable for constructing a :class:`DefiLlamaData`.
        """
        slug = identifier.strip().lower()

        # Fire off parallel fetches
        protocol_task = asyncio.create_task(self._fetch_protocol(slug))
        fees_task = asyncio.create_task(self._fetch_fees(slug))
        volume_task = asyncio.create_task(self._fetch_volume(slug))

        protocol_data = await protocol_task  # required — let it raise

        # Optional endpoints
        fees_data: Dict[str, Any] = {}
        volume_data: Dict[str, Any] = {}
        try:
            fees_data = await fees_task
        except Exception as exc:
            logger.warning("[defillama] fees fetch failed for %s: %s", slug, exc)
        try:
            volume_data = await volume_task
        except Exception as exc:
            logger.warning("[defillama] volume fetch failed for %s: %s", slug, exc)

        # Parse TVL history
        tvl_history = self._extract_tvl_history(protocol_data)

        # Current TVL
        current_tvl: float = 0.0
        chain_tvls = protocol_data.get("currentChainTvls", {})
        if isinstance(chain_tvls, dict):
            # Sum only chain-level keys (exclude staking/pool/borrowed duplicates)
            for key, val in chain_tvls.items():
                if "-" not in key:  # skip "Ethereum-staking" style dupes
                    current_tvl += float(val or 0)
        if current_tvl == 0:
            current_tvl = float(protocol_data.get("tvl", 0) if not isinstance(protocol_data.get("tvl"), list) else 0)

        # TVL changes
        change_1d = protocol_data.get("change_1d")
        change_7d = protocol_data.get("change_7d")
        change_30d = protocol_data.get("change_1m")

        # Chains
        chains = protocol_data.get("chains", [])

        # Fee / Revenue from the fees endpoint
        fees_24h = fees_data.get("total24h")
        fees_7d = fees_data.get("total7d")
        revenue_24h = fees_data.get("totalRevenue24h") or fees_data.get("revenue24h")
        revenue_7d = fees_data.get("totalRevenue7d") or fees_data.get("revenue7d")

        # Volume
        volume_24h = volume_data.get("total24h")

        # GitHub repos
        github_repos: List[str] = []
        raw_github = protocol_data.get("github", [])
        if isinstance(raw_github, list):
            github_repos = raw_github
        elif isinstance(raw_github, str) and raw_github:
            github_repos = [raw_github]

        return {
            "protocol_name": protocol_data.get("name", slug),
            "protocol_slug": slug,
            "category": protocol_data.get("category", ""),
            "chains": chains if isinstance(chains, list) else [],
            "tvl_usd": current_tvl,
            "tvl_history": tvl_history,
            "change_1d": _safe_float(change_1d),
            "change_7d": _safe_float(change_7d),
            "change_30d": _safe_float(change_30d),
            "mcap": _safe_float(protocol_data.get("mcap")),
            "fdv": _safe_float(protocol_data.get("fdv")),
            "fees_24h": _safe_float(fees_24h),
            "fees_7d": _safe_float(fees_7d),
            "revenue_24h": _safe_float(revenue_24h),
            "revenue_7d": _safe_float(revenue_7d),
            "volume_24h": _safe_float(volume_24h),
            "description": protocol_data.get("description", ""),
            "url": protocol_data.get("url", ""),
            "twitter": protocol_data.get("twitter", ""),
            "github_repos": github_repos,
            "audit_links": protocol_data.get("audits", []) if isinstance(protocol_data.get("audits"), list) else [],
            "listed_at": protocol_data.get("listedAt"),
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    @staticmethod
    def to_dataclass(data: Dict[str, Any]) -> DefiLlamaData:
        """Convert a raw data dict to a :class:`DefiLlamaData` instance."""
        return DefiLlamaData(**{
            k: v for k, v in data.items()
            if k in DefiLlamaData.__dataclass_fields__
        })


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _safe_float(val: Any) -> Optional[float]:
    """Convert to float or return None."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
