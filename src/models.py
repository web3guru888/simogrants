"""
SIMOGRANTS — Pydantic models for API request/response.
"""
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional


# --- Project Models ---

class ProjectCreate(BaseModel):
    """Request body for creating a project."""
    name: str
    description: str = ""
    github_url: Optional[str] = None
    contract_addresses: Optional[list[str]] = None
    defillama_slug: Optional[str] = None
    snapshot_space: Optional[str] = None
    package_names: Optional[dict[str, str]] = None  # e.g. {"npm": "ethers"}


class ProjectResponse(BaseModel):
    """Response for a project."""
    project_id: str
    name: str
    description: str
    github_url: Optional[str] = None
    contract_addresses: Optional[list[str]] = None
    defillama_slug: Optional[str] = None
    snapshot_space: Optional[str] = None
    package_names: Optional[dict[str, str]] = None
    created_at: str
    updated_at: str


# --- Collection Models ---

class CollectRequest(BaseModel):
    """Request to trigger data collection for a project."""
    force_recollect: bool = False


class ProfileResponse(BaseModel):
    """Response with collected project profile."""
    project_id: str
    data_completeness: float
    collected_at: str
    profile: dict  # Full ProjectProfile data


class BatchCollectRequest(BaseModel):
    """Request to collect data for multiple projects."""
    project_ids: list[str]


# --- Evaluation Models ---

class EvaluateRequest(BaseModel):
    """Request to evaluate a project."""
    force_recollect: bool = False


class DimensionScoreResponse(BaseModel):
    score: int
    justification: str


class StakeholderEvaluationResponse(BaseModel):
    agent_type: str
    scores: dict[str, DimensionScoreResponse]
    overall_narrative: str
    confidence: float


class TensionResponse(BaseModel):
    dimension: str
    agents: dict[str, int]
    spread: int
    high_agent: str
    low_agent: str
    narrative: str = ""


class EvaluationResponse(BaseModel):
    project_id: str
    stakeholder_evaluations: list[StakeholderEvaluationResponse]
    aggregated_scores: dict[str, float]
    overall_score: float
    bradley_terry_rank: Optional[float] = None
    tensions: list[TensionResponse]
    data_completeness: float
    evaluated_at: str


class BatchEvaluateRequest(BaseModel):
    project_ids: list[str]


class CompareRequest(BaseModel):
    """Request to pairwise compare two projects."""
    project_a_id: str
    project_b_id: str


# --- Mechanism Models ---

class AllocateRequest(BaseModel):
    """Request to compute SQF allocation."""
    project_ids: list[str]
    matching_pool: float = 100000.0
    contributions: Optional[dict[str, list[float]]] = None
    dependencies: Optional[list[list[str]]] = None  # [[dependent, dependency], ...]


class AllocationResponse(BaseModel):
    epoch: int
    matching_pool: float
    allocations: dict[str, float]  # project_id -> amount
    modifiers: dict[str, dict[str, float]]  # project_id -> {pheromone, pagerank, qf_base}
    pheromone_state: dict[str, float]


class PheromoneResponse(BaseModel):
    state: dict[str, float]
    epoch: int


class PageRankResponse(BaseModel):
    scores: dict[str, float]
    graph_size: int


class BacktestRequest(BaseModel):
    n_projects: int = 10
    n_epochs: int = 5
    matching_pool: float = 100000.0


class BacktestResponse(BaseModel):
    epochs: list[dict]
    summary: dict


class EpochAdvanceRequest(BaseModel):
    accuracy_scores: dict[str, float]  # project_id -> accuracy (0-1)


# --- Attestation Models ---

class AttestRequest(BaseModel):
    """Request to publish on-chain attestation."""
    project_id: str
    evaluation_id: Optional[int] = None


class AttestationResponse(BaseModel):
    project_id: str
    evaluation_hash: str
    filecoin_cid: Optional[str] = None
    tx_hash: Optional[str] = None
    epoch: Optional[int] = None
    attested_at: str


class BatchAttestRequest(BaseModel):
    project_ids: list[str]


# --- Pipeline Models ---

class PipelineRequest(BaseModel):
    """Request to run the full pipeline."""
    projects: list[ProjectCreate]
    matching_pool: float = 100000.0
    publish_onchain: bool = False


class PipelineStatusResponse(BaseModel):
    run_id: str
    status: str
    project_ids: list[str]
    matching_pool: Optional[float] = None
    started_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None


class PipelineResultsResponse(BaseModel):
    run_id: str
    status: str
    profiles: dict[str, dict] = {}
    evaluations: dict[str, dict] = {}
    allocations: dict[str, float] = {}
    attestations: dict[str, dict] = {}
