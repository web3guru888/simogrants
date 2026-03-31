"""
SIMOGRANTS Snapshot Collector
==============================
Gathers governance data from Snapshot via its GraphQL API: space metadata,
proposal counts, voter turnout, and recent proposals.

Identifier format: the Snapshot **space ID**, e.g. ``"aave.eth"``,
``"gitcoindao.eth"``, ``"ens.eth"``.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .base import BaseCollector
from .models import SnapshotData

logger = logging.getLogger(__name__)

SNAPSHOT_GRAPHQL = "https://hub.snapshot.org/graphql"


class SnapshotCollector(BaseCollector):
    """Collector for Snapshot governance data."""

    source_name: str = "snapshot"

    def __init__(
        self,
        *,
        timeout: float = 30.0,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> None:
        super().__init__(timeout=timeout, max_retries=max_retries, **kwargs)

    # ------------------------------------------------------------------
    # GraphQL helpers
    # ------------------------------------------------------------------

    async def _graphql(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a Snapshot GraphQL query."""
        body: Dict[str, Any] = {"query": query}
        if variables:
            body["variables"] = variables
        result = await self._post_json(SNAPSHOT_GRAPHQL, json_body=body)
        if "errors" in result:
            raise RuntimeError(f"Snapshot GraphQL errors: {result['errors']}")
        return result.get("data", {})

    async def _fetch_space(self, space_id: str) -> Dict[str, Any]:
        """Fetch space metadata."""
        query = """
        query Space($id: String!) {
          space(id: $id) {
            id
            name
            about
            network
            symbol
            members
            followersCount
            proposalsCount
            categories
            website
            strategies {
              name
              network
              params
            }
          }
        }
        """
        data = await self._graphql(query, {"id": space_id})
        return data.get("space") or {}

    async def _fetch_proposals(
        self, space_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Fetch recent proposals."""
        query = """
        query Proposals($space: String!, $first: Int!) {
          proposals(
            first: $first,
            skip: 0,
            where: { space_in: [$space] },
            orderBy: "created",
            orderDirection: desc
          ) {
            id
            title
            state
            author
            created
            start
            end
            votes
            scores_total
            choices
          }
        }
        """
        data = await self._graphql(query, {"space": space_id, "first": limit})
        return data.get("proposals", [])

    # ------------------------------------------------------------------
    # Main implementation
    # ------------------------------------------------------------------

    async def _collect_impl(self, identifier: str) -> Dict[str, Any]:
        """
        Collect Snapshot governance data.

        Parameters
        ----------
        identifier:
            Snapshot space ID, e.g. ``"aave.eth"``.
        """
        space_id = identifier.strip().lower()

        # Fetch space and proposals in sequence (space is required)
        space = await self._fetch_space(space_id)
        if not space:
            raise ValueError(f"Snapshot space not found: {space_id!r}")

        proposals: List[Dict[str, Any]] = []
        try:
            proposals = await self._fetch_proposals(space_id)
        except Exception as exc:
            logger.warning("[snapshot] proposals fetch failed: %s", exc)

        # Compute voting stats
        total_votes = 0
        proposals_with_votes = 0
        recent: List[Dict[str, Any]] = []
        for p in proposals:
            votes = p.get("votes", 0)
            total_votes += votes
            if votes > 0:
                proposals_with_votes += 1
            recent.append({
                "id": p.get("id", ""),
                "title": (p.get("title") or "")[:120],
                "state": p.get("state", ""),
                "votes": votes,
                "created": p.get("created"),
                "choices_count": len(p.get("choices", [])),
            })

        avg_votes = (total_votes / proposals_with_votes) if proposals_with_votes else 0.0
        members = space.get("members", [])
        members_count = len(members) if isinstance(members, list) else int(members or 0)
        avg_turnout = (avg_votes / members_count * 100) if members_count > 0 else 0.0

        strategies = space.get("strategies", [])
        strategy_list = [
            {"name": s.get("name", ""), "network": s.get("network", "")}
            for s in (strategies if isinstance(strategies, list) else [])
        ]

        return {
            "space_id": space.get("id", space_id),
            "space_name": space.get("name", ""),
            "network": space.get("network", ""),
            "symbol": space.get("symbol", ""),
            "members_count": members_count,
            "proposals_count": space.get("proposalsCount", len(proposals)),
            "followers_count": space.get("followersCount", 0),
            "voting_power_symbol": space.get("symbol", ""),
            "strategies": strategy_list,
            "recent_proposals": recent[:10],
            "avg_voter_turnout": round(avg_turnout, 2),
            "avg_votes_per_proposal": round(avg_votes, 2),
            "categories": space.get("categories", []) if isinstance(space.get("categories"), list) else [],
            "website": space.get("website", ""),
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def to_dataclass(data: Dict[str, Any]) -> SnapshotData:
        """Convert raw data dict to :class:`SnapshotData`."""
        return SnapshotData(**{
            k: v for k, v in data.items()
            if k in SnapshotData.__dataclass_fields__
        })
