"""
SIMOGRANTS Octant Collector
=============================
Gathers data from Octant's public API: project epochs, GLM allocations,
matching amounts, and donor statistics.

Identifier format: project name or Ethereum address associated with the
Octant project.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .base import BaseCollector
from .models import OctantData

logger = logging.getLogger(__name__)

# Octant public API endpoints
OCTANT_API = "https://backend.mainnet.octant.app"


class OctantCollector(BaseCollector):
    """Collector for Octant public goods funding data."""

    source_name: str = "octant"

    def __init__(
        self,
        *,
        timeout: float = 30.0,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> None:
        super().__init__(timeout=timeout, max_retries=max_retries, **kwargs)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_epochs(self) -> List[int]:
        """Return list of known epoch numbers."""
        url = f"{OCTANT_API}/epochs/current"
        try:
            data = await self._get_json(url)
            current = int(data.get("currentEpoch", 0))
            return list(range(1, current + 1))
        except Exception:
            # Fallback: try epochs 1-6
            return list(range(1, 7))

    async def _get_epoch_projects(self, epoch: int) -> List[Dict[str, Any]]:
        """Fetch projects for a specific epoch."""
        url = f"{OCTANT_API}/epochs/{epoch}/projects"
        try:
            data = await self._get_json(url)
            if isinstance(data, list):
                return data
            return data.get("projects", data.get("data", []))
        except Exception:
            return []

    async def _get_epoch_allocations(self, epoch: int, project_address: str) -> Dict[str, Any]:
        """Fetch allocation data for a project in a specific epoch."""
        url = f"{OCTANT_API}/epochs/{epoch}/allocations/{project_address}"
        try:
            data = await self._get_json(url)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    async def _find_project(self, identifier: str) -> Dict[str, Any]:
        """
        Search across epochs to find a project by name or address.

        Returns dict with 'address', 'name', 'epochs_found', etc.
        """
        identifier_lower = identifier.strip().lower()
        is_address = identifier_lower.startswith("0x") and len(identifier_lower) == 42

        epochs = await self._get_epochs()
        found_address = ""
        found_name = ""
        epochs_found: List[int] = []
        project_info: Dict[str, Any] = {}

        for epoch in reversed(epochs):  # newest first
            projects = await self._get_epoch_projects(epoch)
            for p in projects:
                addr = (p.get("address") or p.get("projectAddress") or "").lower()
                name = (p.get("name") or p.get("projectName") or "").lower()

                match = False
                if is_address and addr == identifier_lower:
                    match = True
                elif not is_address and identifier_lower in name:
                    match = True

                if match:
                    if not found_address:
                        found_address = addr
                        found_name = p.get("name") or p.get("projectName") or identifier
                        project_info = p
                    epochs_found.append(epoch)
                    break  # found in this epoch, move to next

        return {
            "address": found_address,
            "name": found_name,
            "epochs_found": sorted(set(epochs_found)),
            "info": project_info,
        }

    # ------------------------------------------------------------------
    # Main implementation
    # ------------------------------------------------------------------

    async def _collect_impl(self, identifier: str) -> Dict[str, Any]:
        """
        Collect Octant data for a project.

        Parameters
        ----------
        identifier:
            Project name or Ethereum address.
        """
        project = await self._find_project(identifier)
        if not project.get("address"):
            raise ValueError(f"Octant project not found: {identifier!r}")

        address = project["address"]
        name = project["name"]
        epochs = project["epochs_found"]
        info = project.get("info", {})

        # Fetch allocations per epoch
        allocation_history: List[Dict[str, Any]] = []
        total_allocated = 0.0
        total_matched = 0.0
        all_donors: set = set()

        for epoch in epochs:
            alloc = await self._get_epoch_allocations(epoch, address)
            epoch_allocated = float(alloc.get("amount", 0) or alloc.get("allocatedAmount", 0) or 0)
            epoch_matched = float(alloc.get("matched", 0) or alloc.get("matchedAmount", 0) or 0)
            donors = alloc.get("donors", []) or alloc.get("allocations", [])

            total_allocated += epoch_allocated
            total_matched += epoch_matched

            if isinstance(donors, list):
                for d in donors:
                    donor_addr = d.get("donor") or d.get("address") or ""
                    if donor_addr:
                        all_donors.add(donor_addr.lower())

            allocation_history.append({
                "epoch": epoch,
                "allocated_glm": epoch_allocated,
                "matched_usd": epoch_matched,
                "donors": len(donors) if isinstance(donors, list) else 0,
            })

        return {
            "project_name": name,
            "project_address": address,
            "epochs_participated": epochs,
            "total_allocated_glm": round(total_allocated, 4),
            "total_matched_usd": round(total_matched, 2),
            "donors_count": sum(a.get("donors", 0) for a in allocation_history),
            "unique_donors": len(all_donors),
            "allocation_history": allocation_history,
            "description": info.get("description", info.get("projectDescription", ""))[:500],
            "website": info.get("website") or info.get("projectWebsite") or "",
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def to_dataclass(data: Dict[str, Any]) -> OctantData:
        """Convert raw data dict to :class:`OctantData`."""
        return OctantData(**{
            k: v for k, v in data.items()
            if k in OctantData.__dataclass_fields__
        })
