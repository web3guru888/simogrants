/**
 * SIMOGRANTS — TypeScript types matching D1 schema and API contract
 * @see /shared/PL_API_SPEC.md
 */

// ─── Cloudflare Bindings ────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  EVIDENCE: R2Bucket;
  ENVIRONMENT: string;
  ASI1_API_KEY?: string;
  ASI1_MODEL?: string;
  WEB3_STORAGE_TOKEN?: string;
}

// ─── DB Row Types (mirror D1 schema) ────────────────────────────────

export interface UserRow {
  address: string;
  display_name: string | null;
  created_at: string;
  last_login: string;
}

export interface RoundRow {
  id: string;
  title: string;
  description: string;
  creator_address: string;
  status: RoundStatus;
  matching_pool: number;
  currency: string;
  chain: string;
  application_deadline: string | null;
  max_applications: number | null;
  evaluation_config: string | null; // JSON
  contract_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  description: string;
  website: string | null;
  github_url: string | null;
  team_size: number | null;
  category: string | null;
  created_by: string;
  overall_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  round_id: string;
  project_id: string;
  status: ApplicationStatus;
  applied_at: string;
  evaluated_at: string | null;
}

export interface EvaluationRow {
  id: number;
  application_id: string;
  evaluation_data: string; // JSON
  overall_score: number | null;
  data_completeness: number | null;
  bradley_terry_rank: number | null;
  evaluated_at: string;
}

export interface AllocationRow {
  id: number;
  round_id: string;
  application_id: string;
  amount: number;
  qf_base: number | null;
  pheromone_modifier: number | null;
  pagerank_modifier: number | null;
  pheromone_state: string | null; // JSON
  epoch: number;
  computed_at: string;
}

export interface EvidenceRow {
  id: number;
  project_id: string;
  round_id: string | null;
  r2_key: string;
  file_name: string | null;
  file_size: number | null;
  content_type: string | null;
  evidence_type: string;
  uploaded_at: string;
}

export interface PipelineRunRow {
  run_id: string;
  round_id: string;
  status: PipelineStatus;
  step: string | null;
  config: string | null; // JSON
  results: string | null; // JSON
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

// ─── Enums / Union Types ────────────────────────────────────────────

export type RoundStatus = 'active' | 'accepting' | 'evaluating' | 'funded' | 'closed';
export type ApplicationStatus = 'submitted' | 'evaluating' | 'evaluated' | 'funded' | 'rejected';
export type PipelineStatus = 'pending' | 'collecting' | 'evaluating' | 'allocating' | 'attesting' | 'complete' | 'failed';

// ─── API Request / Response Types ───────────────────────────────────

// Auth
export interface AuthNonceResponse {
  nonce: string;
  message: string;
}

export interface AuthVerifyRequest {
  message: string;
  signature: string;
}

export interface AuthVerifyResponse {
  token: string;
  address: string;
  chainId: number;
}

export interface AuthMeResponse {
  address: string;
  chainId: number;
  roundsCreated: number;
  applicationsSubmitted: number;
}

// Rounds
export interface CreateRoundRequest {
  title: string;
  description: string;
  matchingPool: number;
  currency?: string;
  chain?: string;
  applicationDeadline: string;
  maxApplications?: number;
  evaluationConfig?: EvaluationConfig;
}

export interface EvaluationConfig {
  enableTensionDetection?: boolean;
  tensionThreshold?: number;
  stakeholderWeights?: {
    developer: number;
    user: number;
    funder: number;
    ecosystem: number;
  };
}

export interface RoundResponse extends Omit<RoundRow, 'creator_address' | 'created_at' | 'updated_at'> {
  creatorAddress: string;
  applicationsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoundDetailResponse {
  round: RoundResponse;
  applications: ApplicationSummary[];
  statistics: {
    totalApplications: number;
    totalMatchingPool: number;
    allocated: number;
    averageScore: number | null;
  };
}

export interface ApplicationSummary {
  id: string;
  projectId: string;
  projectName: string;
  status: ApplicationStatus;
  overallScore: number | null;
}

// Projects
export interface CreateProjectRequest {
  name: string;
  description: string;
  website?: string;
  githubUrl?: string;
  teamSize?: number;
  category?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  website: string | null;
  githubUrl: string | null;
  teamSize: number | null;
  category: string | null;
  createdBy: string;
  overallScore: number | null;
  totalFundingReceived?: number;
  createdAt: string;
}

export interface ProjectDetailResponse {
  project: ProjectResponse;
  evaluations: EvaluationDetail[];
  allocations: AllocationDetail[];
}

// Evaluation detail
export interface EvaluationDetail {
  id: number;
  roundId: string;
  stakeholderEvaluations: Record<string, StakeholderEval>;
  aggregatedScores: Record<string, number>;
  overallScore: number | null;
  bradleyTerryRank: number | null;
  tensions: Tension[];
  evaluatedAt: string;
}

export interface StakeholderEval {
  scores: Record<string, number>;
  narrative: string;
  confidence: number;
}

export interface Tension {
  dimension: string;
  agents: Record<string, number>;
  spread: number;
  narrative: string;
}

// Allocation detail
export interface AllocationDetail {
  roundId: string;
  amount: number;
  currency: string;
  sqfDetails: {
    qfBase: number;
    pheromoneMod: number;
    pagerankMod: number;
  };
}

// Pipeline
export interface PipelineRunResponse {
  runId: string;
  status: PipelineStatus;
  progress?: {
    total: number;
    completed: number;
    failed: number;
  };
  results?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

// SQF Allocation
export interface SQFAllocationResponse {
  roundId: string;
  epoch: number;
  matchingPool: number;
  allocations: Record<string, SQFProjectAllocation>;
  pheromoneState: Record<string, number>;
  totalAllocated: number;
}

export interface SQFProjectAllocation {
  amount: number;
  qfBase: number;
  pheromoneMod: number;
  pagerankMod: number;
}

// Results
export interface RoundResultsResponse {
  round: RoundResponse;
  results: ResultEntry[];
  summary: {
    totalPool: number;
    totalAllocated: number;
    projectsFunded: number;
    averageScore: number | null;
  };
}

export interface ResultEntry {
  rank: number;
  project: ProjectResponse;
  score: number | null;
  allocation: number;
  sqfDetails: SQFProjectAllocation;
}

// Evidence
export interface EvidenceListResponse {
  evidence: EvidenceEntry[];
}

export interface EvidenceEntry {
  key: string;
  uploadedAt: string;
  size: number | null;
  type: string;
}

// Session (stored in KV)
export interface SessionData {
  address: string;
  chainId: number;
  expiresAt: number; // Unix timestamp ms
}

// ─── Evaluation Engine Types (for mock evaluator + SQF) ───────────

export interface DimensionScore {
  score: number;
  justification: string;
}

export interface StakeholderEvalDetail {
  scores: Record<string, DimensionScore>;
  narrative: string;
  confidence: number;
  mean_score: number;
}

export interface EvaluationData {
  stakeholder_evaluations: Record<string, StakeholderEvalDetail>;
  aggregated_scores: Record<string, number>;
  tensions: TensionDetail[];
  overall_score: number;
  bradley_terry_rank?: number;
  data_completeness: number;
  evaluated_at: string;
}

export interface TensionDetail {
  dimension: string;
  agents: Record<string, number>;
  spread: number;
  high_agent?: string;
  low_agent?: string;
  narrative: string;
}

export const STAKEHOLDER_DIMENSIONS: Record<string, string[]> = {
  developer: ['code_quality', 'maintenance_health', 'security_posture'],
  user: ['adoption_metrics', 'community_engagement', 'user_experience'],
  funder: ['capital_efficiency', 'funding_sustainability', 'track_record'],
  ecosystem: ['composability', 'network_effects', 'mission_alignment'],
};

export const ALL_DIMENSIONS = Object.values(STAKEHOLDER_DIMENSIONS).flat();

export const DEFAULT_WEIGHTS: Record<string, number> = {
  developer: 0.25,
  user: 0.25,
  funder: 0.25,
  ecosystem: 0.25,
};

export const DIMENSION_LABELS: Record<string, string> = {
  code_quality: 'Code Quality',
  maintenance_health: 'Maintenance Health',
  security_posture: 'Security Posture',
  adoption_metrics: 'Adoption Metrics',
  community_engagement: 'Community Engagement',
  user_experience: 'User Experience',
  capital_efficiency: 'Capital Efficiency',
  funding_sustainability: 'Funding Sustainability',
  track_record: 'Track Record',
  composability: 'Composability',
  network_effects: 'Network Effects',
  mission_alignment: 'Mission Alignment',
};

// ─── Standard Error Response ──────────────────────────────────────

export interface ErrorResponse {
  error: string;
  code: number;
  details?: unknown;
  path?: string;
}

// ─── List Response Wrappers ───────────────────────────────────────

export interface RoundsListResponse {
  rounds: RoundResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProjectsListResponse {
  projects: ProjectResponse[];
  total: number;
}

// ─── Additional Request Types ─────────────────────────────────────

export interface AllocateRequest {
  matchingPool?: number;
  customContributions?: Record<string, number[]> | null;
  dependencies?: [string, string][] | null;
}

export interface PipelineRunRequest {
  roundId: string;
  skipEvaluation?: boolean;
  recalculateAllocation?: boolean;
}

export interface ApplyRequest {
  projectId: string;
}

// ─── Additional Response Types ────────────────────────────────────

export interface ApplyResponse {
  applicationId: string;
  roundId: string;
  projectId: string;
  status: ApplicationStatus;
  appliedAt: string;
}

export interface CloseRoundResponse {
  message: string;
  pipelineRunId: string;
  roundId: string;
}

export interface EvaluateTriggerResponse {
  pipelineRunId: string;
  status: string;
  projectCount: number;
  failed?: number;
  results?: unknown;
  estimatedTime: string;
}

export interface EvidenceUploadResponse {
  key: string;
  size: number;
  type: string;
  uploadedAt: string;
  url: string;
}

export interface StatsResponse {
  overview: {
    totalRounds: number;
    totalProjects: number;
    totalApplications: number;
    totalMatchingPool: number;
    totalAllocated: number;
    averageScore: number | null;
    totalEvaluations: number;
  };
  roundsByStatus: Record<string, number>;
  recentActivity: {
    recentEvaluations: RecentEvaluation[];
  };
}

export interface RecentEvaluation {
  id: number;
  overallScore: number | null;
  dataCompleteness: number | null;
  evaluatedAt: string;
  projectName: string;
  projectId: string;
  roundTitle: string;
  roundId: string;
}

export interface PipelineRunFullResponse {
  runId: string;
  status: PipelineStatus;
  roundId: string;
  roundTitle: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  results: {
    totalAllocated: number;
    currency: string;
    allocationCount: number;
    pheromoneState: Record<string, number>;
  };
  startedAt: string;
  completedAt: string;
}

// ─── App Bindings type (for Hono) ──────────────────────────────────

export type AppBindings = {
  Bindings: Env;
};
