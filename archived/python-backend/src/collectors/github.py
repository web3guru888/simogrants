"""
SIMOGRANTS GitHub Collector
============================
Gathers repository metadata, contributor counts, recent commits, pull-request
stats, and community health signals from the GitHub REST API.

Identifier format: ``"owner/repo"``
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .base import BaseCollector
from .models import GitHubData

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


class GitHubCollector(BaseCollector):
    """Collector for GitHub repository data."""

    source_name: str = "github"

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> None:
        headers: Dict[str, str] = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        headers["Accept"] = "application/vnd.github+json"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
        super().__init__(
            api_key=api_key,
            timeout=timeout,
            max_retries=max_retries,
            headers=headers,
            **kwargs,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_repo(self, owner: str, repo: str) -> Dict[str, Any]:
        """Fetch core repository metadata."""
        url = f"{GITHUB_API}/repos/{owner}/{repo}"
        return await self._get_json(url)

    async def _fetch_languages(self, owner: str, repo: str) -> Dict[str, int]:
        """Fetch language byte counts."""
        url = f"{GITHUB_API}/repos/{owner}/{repo}/languages"
        return await self._get_json(url)

    async def _fetch_contributors_count(self, owner: str, repo: str) -> int:
        """
        Estimate contributor count from the ``/contributors`` endpoint.

        We request 1 item per page and inspect the ``Link`` header to
        find the last page number → total contributors.
        """
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contributors"
        client = await self._get_client()
        resp = await client.get(url, params={"per_page": "1", "anon": "true"})
        resp.raise_for_status()
        link = resp.headers.get("link", "")
        if 'rel="last"' in link:
            # Parse last page number from Link header
            for part in link.split(","):
                if 'rel="last"' in part:
                    try:
                        page_str = part.split("page=")[-1].split(">")[0]
                        return int(page_str)
                    except (ValueError, IndexError):
                        pass
        # Fallback: count items in the response
        data = resp.json()
        return len(data) if isinstance(data, list) else 0

    async def _fetch_recent_commits(
        self, owner: str, repo: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Fetch the most recent commits."""
        url = f"{GITHUB_API}/repos/{owner}/{repo}/commits"
        items = await self._get_json(url, params={"per_page": str(limit)})
        results: List[Dict[str, Any]] = []
        for c in items[:limit]:
            commit = c.get("commit", {})
            results.append({
                "sha": c.get("sha", "")[:8],
                "message": commit.get("message", "").split("\n")[0][:120],
                "author": commit.get("author", {}).get("name", ""),
                "date": commit.get("author", {}).get("date", ""),
            })
        return results

    async def _fetch_commit_activity(self, owner: str, repo: str) -> int:
        """Return total commits in the last 52 weeks from commit activity."""
        url = f"{GITHUB_API}/repos/{owner}/{repo}/stats/commit_activity"
        try:
            data = await self._get_json(url)
            if isinstance(data, list):
                return sum(week.get("total", 0) for week in data)
        except Exception:
            logger.debug("[github] commit_activity unavailable for %s/%s", owner, repo)
        return 0

    async def _fetch_pulls_summary(
        self, owner: str, repo: str
    ) -> Dict[str, int]:
        """Count open and closed pull requests (approximate via per_page=1)."""
        counts: Dict[str, int] = {"open": 0, "closed": 0}
        for state in ("open", "closed"):
            url = f"{GITHUB_API}/repos/{owner}/{repo}/pulls"
            client = await self._get_client()
            resp = await client.get(
                url, params={"state": state, "per_page": "1"}
            )
            if resp.status_code != 200:
                continue
            link = resp.headers.get("link", "")
            if 'rel="last"' in link:
                for part in link.split(","):
                    if 'rel="last"' in part:
                        try:
                            page_str = part.split("page=")[-1].split(">")[0]
                            counts[state] = int(page_str)
                        except (ValueError, IndexError):
                            pass
            else:
                data = resp.json()
                counts[state] = len(data) if isinstance(data, list) else 0
        return counts

    async def _check_community_files(
        self, owner: str, repo: str
    ) -> Dict[str, bool]:
        """Check for README, CONTRIBUTING, LICENSE, CODE_OF_CONDUCT."""
        url = f"{GITHUB_API}/repos/{owner}/{repo}/community/profile"
        checks = {
            "has_readme": False,
            "has_contributing": False,
            "has_license": False,
            "has_code_of_conduct": False,
        }
        try:
            data = await self._get_json(url)
            files = data.get("files", {})
            checks["has_readme"] = files.get("readme") is not None
            checks["has_contributing"] = files.get("contributing") is not None
            checks["has_license"] = files.get("license") is not None
            checks["has_code_of_conduct"] = files.get("code_of_conduct") is not None
        except Exception:
            logger.debug("[github] community profile unavailable for %s/%s", owner, repo)
        return checks

    # ------------------------------------------------------------------
    # Main collection implementation
    # ------------------------------------------------------------------

    async def _collect_impl(self, identifier: str) -> Dict[str, Any]:
        """
        Collect GitHub data for ``owner/repo``.

        Parameters
        ----------
        identifier:
            ``"owner/repo"`` string.

        Returns
        -------
        dict suitable for constructing a :class:`GitHubData`.
        """
        parts = identifier.strip("/").split("/")
        if len(parts) < 2:
            raise ValueError(
                f"GitHub identifier must be 'owner/repo', got: {identifier!r}"
            )
        owner, repo = parts[0], parts[1]

        # Fetch core repo data first (required)
        repo_data = await self._fetch_repo(owner, repo)

        # Fire off parallel requests for supplementary data
        import asyncio

        langs_task = asyncio.create_task(self._fetch_languages(owner, repo))
        contribs_task = asyncio.create_task(self._fetch_contributors_count(owner, repo))
        commits_task = asyncio.create_task(self._fetch_recent_commits(owner, repo))
        activity_task = asyncio.create_task(self._fetch_commit_activity(owner, repo))
        pulls_task = asyncio.create_task(self._fetch_pulls_summary(owner, repo))
        community_task = asyncio.create_task(self._check_community_files(owner, repo))

        # Await with individual error tolerance
        languages: Dict[str, int] = {}
        contributors_count = 0
        recent_commits: List[Dict[str, Any]] = []
        commits_last_year = 0
        pulls: Dict[str, int] = {"open": 0, "closed": 0}
        community: Dict[str, bool] = {}

        for name, task, setter in [
            ("languages", langs_task, None),
            ("contributors", contribs_task, None),
            ("commits", commits_task, None),
            ("activity", activity_task, None),
            ("pulls", pulls_task, None),
            ("community", community_task, None),
        ]:
            try:
                result = await task
                if name == "languages":
                    languages = result
                elif name == "contributors":
                    contributors_count = result
                elif name == "commits":
                    recent_commits = result
                elif name == "activity":
                    commits_last_year = result
                elif name == "pulls":
                    pulls = result
                elif name == "community":
                    community = result
            except Exception as exc:
                logger.warning("[github] sub-fetch '%s' failed for %s/%s: %s", name, owner, repo, exc)

        license_info = repo_data.get("license") or {}

        return {
            "repo_owner": owner,
            "repo_name": repo,
            "full_name": repo_data.get("full_name", f"{owner}/{repo}"),
            "description": repo_data.get("description") or "",
            "language": repo_data.get("language") or "",
            "languages": languages,
            "stars": repo_data.get("stargazers_count", 0),
            "forks": repo_data.get("forks_count", 0),
            "open_issues": repo_data.get("open_issues_count", 0),
            "watchers": repo_data.get("subscribers_count", 0),
            "created_at": repo_data.get("created_at"),
            "updated_at": repo_data.get("updated_at"),
            "pushed_at": repo_data.get("pushed_at"),
            "default_branch": repo_data.get("default_branch", "main"),
            "license_name": license_info.get("spdx_id") or license_info.get("name") or "",
            "topics": repo_data.get("topics", []),
            "is_fork": repo_data.get("fork", False),
            "is_archived": repo_data.get("archived", False),
            "homepage": repo_data.get("homepage") or "",
            "contributors_count": contributors_count,
            "commits_count_last_year": commits_last_year,
            "recent_commits": recent_commits,
            "open_prs": pulls.get("open", 0),
            "closed_prs": pulls.get("closed", 0),
            "has_readme": community.get("has_readme", False),
            "has_contributing": community.get("has_contributing", False),
            "has_license": community.get("has_license", False),
            "has_code_of_conduct": community.get("has_code_of_conduct", False),
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # Convenience: build typed dataclass
    # ------------------------------------------------------------------

    @staticmethod
    def to_dataclass(data: Dict[str, Any]) -> GitHubData:
        """Convert a raw data dict to a :class:`GitHubData` instance."""
        return GitHubData(**{
            k: v for k, v in data.items()
            if k in GitHubData.__dataclass_fields__
        })
