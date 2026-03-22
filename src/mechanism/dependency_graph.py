"""
Dependency graph construction for Stigmergic Quadratic Funding.

Builds a directed graph of (dependent → dependency) relationships between
projects based on their GitHub repositories. Filters out documentation-only
repos and low-signal repos to prevent PageRank inflation of non-core projects.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


# Patterns that indicate a documentation-only or meta repo
DOCS_PATTERNS: list[re.Pattern] = [
    re.compile(r"(^|/)docs?(/|$)", re.IGNORECASE),
    re.compile(r"(^|/)documentation(/|$)", re.IGNORECASE),
    re.compile(r"(^|/)\.github(/|$)", re.IGNORECASE),
    re.compile(r"(^|/)wiki(/|$)", re.IGNORECASE),
    re.compile(r"(^|/)website(/|$)", re.IGNORECASE),
    re.compile(r"(^|/)blog(/|$)", re.IGNORECASE),
    re.compile(r"-docs$", re.IGNORECASE),
    re.compile(r"-website$", re.IGNORECASE),
]

# Well-known infrastructure dependencies that many Ethereum projects use
KNOWN_DEPENDENCIES: dict[str, list[str]] = {
    # OpenZeppelin is a dependency of almost every Solidity project
    "openzeppelin": [
        "@openzeppelin/contracts",
        "openzeppelin-contracts",
        "openzeppelin-solidity",
        "@openzeppelin/upgrades",
    ],
    # Other common infra
    "uniswap": [
        "@uniswap/v2-core",
        "@uniswap/v3-core",
        "@uniswap/sdk",
        "@uniswap/v2-periphery",
        "@uniswap/v3-periphery",
    ],
}


@dataclass
class RepoInfo:
    """Metadata about a repository for dependency analysis."""
    owner: str
    name: str
    full_name: str  # owner/name
    stars: int = 0
    forks: int = 0
    is_fork: bool = False
    topics: list[str] = field(default_factory=list)
    package_names: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)  # package names this repo depends on


@dataclass
class ProjectRepos:
    """All repos belonging to a project."""
    project_id: str
    repos: list[RepoInfo] = field(default_factory=list)
    primary_repo: str | None = None


def is_docs_repo(repo_name: str, full_name: str = "") -> bool:
    """Check if a repository name matches documentation-only patterns."""
    for pattern in DOCS_PATTERNS:
        if pattern.search(repo_name) or (full_name and pattern.search(full_name)):
            return True
    return False


def is_low_signal_repo(stars: int, forks: int, min_stars: int = 10, min_forks: int = 5) -> bool:
    """Check if a repo has too little community signal to be a real dependency."""
    return stars < min_stars and forks < min_forks


def validate_repo(repo: RepoInfo, min_stars: int = 10, min_forks: int = 5) -> bool:
    """
    Validate that a repo should be included in the dependency graph.
    Returns True if the repo is valid (not docs-only, not low-signal).
    """
    if is_docs_repo(repo.name, repo.full_name):
        return False
    if is_low_signal_repo(repo.stars, repo.forks, min_stars, min_forks):
        return False
    return True


def build_dependency_edges(
    projects: list[ProjectRepos],
    min_stars: int = 10,
    min_forks: int = 5,
) -> list[tuple[str, str]]:
    """
    Build dependency graph edges from project repository data.

    Each edge is (dependent_project_id, dependency_project_id), meaning
    the dependent project uses code from the dependency project.

    This gives high PageRank to projects that are widely depended upon
    (like OpenZeppelin), and low PageRank to projects that depend on
    others but aren't themselves dependencies (like docs repos).

    Args:
        projects: List of ProjectRepos with repo metadata
        min_stars: Minimum stars for a repo to count as a dependency
        min_forks: Minimum forks for a repo to count as a dependency

    Returns:
        List of (dependent, dependency) tuples
    """
    # Build a map from package name → project_id for all valid repos
    package_to_project: dict[str, str] = {}
    valid_project_repos: dict[str, list[RepoInfo]] = {}

    for project in projects:
        valid_repos = []
        for repo in project.repos:
            if validate_repo(repo, min_stars, min_forks):
                valid_repos.append(repo)
                # Register all package names this repo provides
                for pkg in repo.package_names:
                    package_to_project[pkg.lower()] = project.project_id
                # Also register the repo name itself as a potential package
                package_to_project[repo.full_name.lower()] = project.project_id
                package_to_project[repo.name.lower()] = project.project_id
        valid_project_repos[project.project_id] = valid_repos

    # Now build edges: for each project's repos, check their dependencies
    edges: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for project in projects:
        for repo in valid_project_repos.get(project.project_id, []):
            for dep in repo.dependencies:
                dep_lower = dep.lower()
                dep_project = package_to_project.get(dep_lower)
                if dep_project and dep_project != project.project_id:
                    edge = (project.project_id, dep_project)
                    if edge not in seen:
                        seen.add(edge)
                        edges.append(edge)

    return edges


def build_dependency_edges_from_known(
    project_ids: list[str],
    project_github_orgs: dict[str, str],
) -> list[tuple[str, str]]:
    """
    Simplified dependency builder using known dependency relationships.

    For hackathon use when we don't have full package.json data:
    uses KNOWN_DEPENDENCIES to infer which projects depend on which.

    Args:
        project_ids: List of project IDs in the evaluation
        project_github_orgs: Map of project_id → GitHub org name

    Returns:
        List of (dependent, dependency) tuples
    """
    # Reverse map: org_name → project_id
    org_to_project: dict[str, str] = {}
    for pid, org in project_github_orgs.items():
        org_to_project[org.lower()] = pid

    # For known infra projects, assume all other projects depend on them
    # This is a reasonable heuristic for Ethereum public goods
    edges: list[tuple[str, str]] = []

    for infra_org, _packages in KNOWN_DEPENDENCIES.items():
        infra_project = org_to_project.get(infra_org.lower())
        if not infra_project:
            continue
        for pid in project_ids:
            if pid != infra_project:
                # Most Ethereum projects depend on OpenZeppelin etc.
                edges.append((pid, infra_project))

    return edges
