"""
SIMOGRANTS Package Registry Collector
=======================================
Gathers package metadata from npm, PyPI, and crates.io: download counts,
dependencies, versions, maintainers.

Identifier format: ``"registry:package_name"``, e.g.:
- ``"npm:ethers"``
- ``"pypi:web3"``
- ``"crates:alloy"``

If no registry prefix, all three are tried.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from .base import BaseCollector
from .models import PackageData

logger = logging.getLogger(__name__)

NPM_API = "https://registry.npmjs.org"
NPM_DOWNLOADS_API = "https://api.npmjs.org/downloads"
PYPI_API = "https://pypi.org/pypi"
CRATES_API = "https://crates.io/api/v1/crates"


class PackagesCollector(BaseCollector):
    """Collector for npm / PyPI / crates.io package data."""

    source_name: str = "packages"

    def __init__(
        self,
        *,
        timeout: float = 30.0,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> None:
        super().__init__(timeout=timeout, max_retries=max_retries, **kwargs)

    # ------------------------------------------------------------------
    # npm
    # ------------------------------------------------------------------

    async def _collect_npm(self, package_name: str) -> Dict[str, Any]:
        """Collect data from the npm registry."""
        # Abbreviated metadata
        url = f"{NPM_API}/{package_name}"
        headers = {"Accept": "application/vnd.npm.install-v1+json"}
        client = await self._get_client()
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        abbrev = resp.json()

        # Full metadata for richer fields
        full_resp = await client.get(f"{NPM_API}/{package_name}")
        full_resp.raise_for_status()
        full = full_resp.json()

        latest_version = full.get("dist-tags", {}).get("latest", "")
        latest_info = full.get("versions", {}).get(latest_version, {})

        # Weekly downloads
        weekly_downloads = 0
        try:
            dl_resp = await client.get(
                f"{NPM_DOWNLOADS_API}/point/last-week/{package_name}"
            )
            if dl_resp.status_code == 200:
                weekly_downloads = dl_resp.json().get("downloads", 0)
        except Exception:
            pass

        # Monthly downloads
        monthly_downloads = 0
        try:
            dl_resp = await client.get(
                f"{NPM_DOWNLOADS_API}/point/last-month/{package_name}"
            )
            if dl_resp.status_code == 200:
                monthly_downloads = dl_resp.json().get("downloads", 0)
        except Exception:
            pass

        maintainers = [
            m.get("name", "") for m in full.get("maintainers", [])
        ]

        time_data = full.get("time", {})
        created = time_data.get("created", "")
        modified = time_data.get("modified", "")

        deps = list(latest_info.get("dependencies", {}).keys())
        repo_url = ""
        repo = full.get("repository", {})
        if isinstance(repo, dict):
            repo_url = repo.get("url", "")
        elif isinstance(repo, str):
            repo_url = repo

        return {
            "registry": "npm",
            "package_name": package_name,
            "version": latest_version,
            "description": full.get("description", ""),
            "weekly_downloads": weekly_downloads,
            "monthly_downloads": monthly_downloads,
            "total_downloads": 0,  # npm doesn't expose total easily
            "dependencies": deps[:50],
            "license_name": full.get("license") or latest_info.get("license") or "",
            "homepage": full.get("homepage", ""),
            "repository_url": repo_url,
            "first_published": created,
            "last_published": modified,
            "maintainers": maintainers,
            "keywords": full.get("keywords", []) if isinstance(full.get("keywords"), list) else [],
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # PyPI
    # ------------------------------------------------------------------

    async def _collect_pypi(self, package_name: str) -> Dict[str, Any]:
        """Collect data from PyPI."""
        url = f"{PYPI_API}/{package_name}/json"
        data = await self._get_json(url)
        info = data.get("info", {})
        releases = data.get("releases", {})

        # Download stats (PyPI uses BigQuery; the JSON API has limited stats)
        # We'll use the info field which sometimes has download counts
        version = info.get("version", "")
        deps = info.get("requires_dist") or []

        # Find first and last release dates
        first_published = ""
        last_published = ""
        for ver, files in releases.items():
            for f in files:
                upload_time = f.get("upload_time", "")
                if upload_time:
                    if not first_published or upload_time < first_published:
                        first_published = upload_time
                    if not last_published or upload_time > last_published:
                        last_published = upload_time

        maintainer = info.get("maintainer") or info.get("author") or ""
        maintainers = [maintainer] if maintainer else []

        project_urls = info.get("project_urls") or {}
        homepage = info.get("home_page") or project_urls.get("Homepage", "")
        repo_url = (
            project_urls.get("Repository")
            or project_urls.get("Source")
            or project_urls.get("Source Code")
            or project_urls.get("GitHub")
            or ""
        )

        keywords_raw = info.get("keywords") or ""
        keywords = [k.strip() for k in keywords_raw.split(",") if k.strip()] if isinstance(keywords_raw, str) else []

        return {
            "registry": "pypi",
            "package_name": package_name,
            "version": version,
            "description": (info.get("summary") or "")[:300],
            "weekly_downloads": 0,
            "monthly_downloads": 0,
            "total_downloads": 0,
            "dependencies": deps[:50],
            "license_name": info.get("license") or "",
            "homepage": homepage,
            "repository_url": repo_url,
            "first_published": first_published,
            "last_published": last_published,
            "maintainers": maintainers,
            "keywords": keywords,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # crates.io
    # ------------------------------------------------------------------

    async def _collect_crates(self, package_name: str) -> Dict[str, Any]:
        """Collect data from crates.io."""
        url = f"{CRATES_API}/{package_name}"
        data = await self._get_json(url)
        crate = data.get("crate", {})
        versions = data.get("versions", [])

        latest = versions[0] if versions else {}
        total_downloads = crate.get("downloads", 0)
        recent_downloads = crate.get("recent_downloads", 0)

        # Fetch owners
        maintainers: List[str] = []
        try:
            owners_data = await self._get_json(f"{CRATES_API}/{package_name}/owners")
            for owner in owners_data.get("users", []):
                maintainers.append(owner.get("login", ""))
        except Exception:
            pass

        deps_list: List[str] = []
        try:
            if latest.get("num"):
                deps_data = await self._get_json(
                    f"{CRATES_API}/{package_name}/{latest['num']}/dependencies"
                )
                for dep in deps_data.get("dependencies", []):
                    if dep.get("kind") == "normal":
                        deps_list.append(dep.get("crate_id", ""))
        except Exception:
            pass

        return {
            "registry": "crates",
            "package_name": package_name,
            "version": latest.get("num", ""),
            "description": (crate.get("description") or "")[:300],
            "weekly_downloads": 0,
            "monthly_downloads": recent_downloads,
            "total_downloads": total_downloads,
            "dependencies": deps_list[:50],
            "license_name": latest.get("license") or "",
            "homepage": crate.get("homepage") or "",
            "repository_url": crate.get("repository") or "",
            "first_published": crate.get("created_at", ""),
            "last_published": crate.get("updated_at", ""),
            "maintainers": maintainers,
            "keywords": crate.get("keywords", []) if isinstance(crate.get("keywords"), list) else [],
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # Router
    # ------------------------------------------------------------------

    def _parse_identifier(self, identifier: str) -> List[Tuple[str, str]]:
        """
        Parse identifier into (registry, package_name) pairs.

        Supports ``"npm:ethers"`` or plain ``"ethers"`` (tries all registries).
        """
        identifier = identifier.strip()
        if ":" in identifier:
            registry, name = identifier.split(":", 1)
            return [(registry.lower().strip(), name.strip())]
        # Try all registries
        return [("npm", identifier), ("pypi", identifier), ("crates", identifier)]

    # ------------------------------------------------------------------
    # Main implementation
    # ------------------------------------------------------------------

    async def _collect_impl(self, identifier: str) -> Dict[str, Any]:
        """
        Collect package data from one or more registries.

        Parameters
        ----------
        identifier:
            ``"registry:name"`` or just ``"name"`` (tries all registries).
        """
        targets = self._parse_identifier(identifier)

        collectors_map = {
            "npm": self._collect_npm,
            "pypi": self._collect_pypi,
            "crates": self._collect_crates,
        }

        if len(targets) == 1:
            registry, name = targets[0]
            fn = collectors_map.get(registry)
            if fn is None:
                raise ValueError(f"Unknown package registry: {registry!r}")
            return await fn(name)

        # Multiple registries — try all, return first success
        results: Dict[str, Any] = {}
        errors: List[str] = []
        for registry, name in targets:
            fn = collectors_map.get(registry)
            if fn is None:
                continue
            try:
                results = await fn(name)
                return results  # return first success
            except Exception as exc:
                errors.append(f"{registry}: {exc}")

        if errors:
            raise ValueError(
                f"Package '{identifier}' not found in any registry: {'; '.join(errors)}"
            )
        raise ValueError(f"No registries to query for: {identifier!r}")

    @staticmethod
    def to_dataclass(data: Dict[str, Any]) -> PackageData:
        """Convert raw data dict to :class:`PackageData`."""
        return PackageData(**{
            k: v for k, v in data.items()
            if k in PackageData.__dataclass_fields__
        })
