"""
SIMOGRANTS Gitcoin Collector
==============================
Gathers project data from the Gitcoin Grants Stack / Allo indexer API:
round participation, donation totals, donor counts, matching amounts.

Identifier format: a Gitcoin project name or ID used for searching.

Note: The Gitcoin Grants API landscape has changed multiple times.  This
collector targets the Grants Stack / Indexer API (grants-stack-indexer).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .base import BaseCollector
from .models import GitcoinData

logger = logging.getLogger(__name__)

# Gitcoin Grants Stack Indexer (commonly used endpoint)
GITCOIN_INDEXER_API = "https://grants-stack-indexer-v2.gitcoin.co"
GITCOIN_GRAPHQL_API = "https://grants-stack-indexer-v2.gitcoin.co/graphql"


class GitcoinCollector(BaseCollector):
    """Collector for Gitcoin Grants data."""

    source_name: str = "gitcoin"

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            api_key=api_key,
            timeout=timeout,
            max_retries=max_retries,
            **kwargs,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _search_projects(self, query: str) -> List[Dict[str, Any]]:
        """
        Search Gitcoin projects by name / keyword.

        Returns a list of project dicts from the indexer.
        """
        url = f"{GITCOIN_INDEXER_API}/data/projects/search"
        try:
            result = await self._get_json(url, params={"q": query})
            if isinstance(result, list):
                return result
            if isinstance(result, dict):
                return result.get("projects", result.get("data", []))
        except Exception:
            pass

        # Fallback: try legacy endpoint
        url_legacy = f"https://indexer-production.fly.dev/data/1/projects.json"
        try:
            all_projects = await self._get_json(url_legacy)
            if isinstance(all_projects, list):
                q_lower = query.lower()
                return [
                    p for p in all_projects
                    if q_lower in (p.get("metadata", {}).get("title", "") or "").lower()
                    or q_lower in (p.get("id", "") or "").lower()
                ][:10]
        except Exception:
            pass

        return []

    async def _get_project_applications(self, project_id: str) -> List[Dict[str, Any]]:
        """Fetch applications (round participations) for a project."""
        url = f"{GITCOIN_INDEXER_API}/data/applications/project/{project_id}"
        try:
            result = await self._get_json(url)
            return result if isinstance(result, list) else []
        except Exception:
            return []

    async def _get_project_donations(self, project_id: str) -> List[Dict[str, Any]]:
        """Fetch donations to a project."""
        url = f"{GITCOIN_INDEXER_API}/data/donations/project/{project_id}"
        try:
            result = await self._get_json(url)
            return result if isinstance(result, list) else []
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Main implementation
    # ------------------------------------------------------------------

    async def _collect_impl(self, identifier: str) -> Dict[str, Any]:
        """
        Collect Gitcoin Grants data.

        Parameters
        ----------
        identifier:
            A project name or Gitcoin project ID to search for.
        """
        identifier = identifier.strip()

        # Step 1: Search for the project
        projects = await self._search_projects(identifier)
        if not projects:
            raise ValueError(f"No Gitcoin project found matching: {identifier!r}")

        # Pick the best match
        project = projects[0]
        for p in projects:
            metadata = p.get("metadata", {})
            title = (metadata.get("title") or metadata.get("name") or "").lower()
            if title == identifier.lower():
                project = p
                break

        metadata = project.get("metadata", {})
        project_id = project.get("id") or project.get("projectId") or ""
        project_name = metadata.get("title") or metadata.get("name") or identifier

        # Step 2: Fetch applications and donations in parallel
        apps_task = asyncio.create_task(self._get_project_applications(str(project_id)))
        donations_task = asyncio.create_task(self._get_project_donations(str(project_id)))

        applications: List[Dict[str, Any]] = []
        donations: List[Dict[str, Any]] = []
        try:
            applications = await apps_task
        except Exception as exc:
            logger.warning("[gitcoin] applications fetch failed: %s", exc)
        try:
            donations = await donations_task
        except Exception as exc:
            logger.warning("[gitcoin] donations fetch failed: %s", exc)

        # Compute aggregates
        total_donations_usd = 0.0
        donor_addresses = set()
        for d in donations:
            total_donations_usd += float(d.get("amountInUsd", 0) or d.get("amount_usd", 0) or 0)
            donor = d.get("donorAddress") or d.get("voter") or ""
            if donor:
                donor_addresses.add(donor.lower())

        rounds_participated: List[Dict[str, Any]] = []
        matching_total = 0.0
        for app in applications:
            round_info = {
                "round_id": app.get("roundId") or app.get("round_id") or "",
                "chain_id": app.get("chainId") or app.get("chain_id") or "",
                "status": app.get("status", ""),
            }
            rounds_participated.append(round_info)
            matching_total += float(app.get("matchAmount") or app.get("match_amount_usd") or 0)

        return {
            "project_id": str(project_id),
            "project_name": project_name,
            "description": (metadata.get("description") or "")[:500],
            "website": metadata.get("website") or metadata.get("projectWebsite") or "",
            "twitter": metadata.get("projectTwitter") or metadata.get("twitter") or "",
            "github": metadata.get("projectGithub") or metadata.get("github") or "",
            "rounds_participated": rounds_participated,
            "total_donations_usd": round(total_donations_usd, 2),
            "total_donors": len(donations),
            "unique_donors": len(donor_addresses),
            "matching_amount_usd": round(matching_total, 2),
            "total_rounds": len(rounds_participated),
            "last_active_round": rounds_participated[-1].get("round_id", "") if rounds_participated else "",
            "tags": metadata.get("tags", []) if isinstance(metadata.get("tags"), list) else [],
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def to_dataclass(data: Dict[str, Any]) -> GitcoinData:
        """Convert raw data dict to :class:`GitcoinData`."""
        return GitcoinData(**{
            k: v for k, v in data.items()
            if k in GitcoinData.__dataclass_fields__
        })
