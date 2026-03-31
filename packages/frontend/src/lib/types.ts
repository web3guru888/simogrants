// Types for the API responses matching PL_API_SPEC.md

export interface Round {
  id: string;
  title: string;
  description: string;
  creatorAddress: string;
  status: 'active' | 'accepting' | 'evaluating' | 'funded' | 'closed';
  matchingPool: number;
  currency: string;
  chain: string;
  applicationDeadline: string;
  maxApplications: number;
  applicationsCount: number;
  contractAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  website?: string;
  githubUrl?: string;
  teamSize: number;
  category: string;
  createdBy: string;
  overallScore?: number;
  totalFundingReceived?: number;
  createdAt: string;
}

export interface Application {
  id: string;
  projectId: string;
  projectName: string;
  status: 'submitted' | 'evaluating' | 'evaluated' | 'funded' | 'rejected';
  overallScore?: number;
  projectScore?: number;
  appliedAt: string;
  evaluatedAt?: string;
}

export interface RoundDetail {
  round: Round;
  applications: Application[];
  statistics: {
    totalApplications: number;
    totalMatchingPool: number;
    allocated: number;
    averageScore: number;
  };
}

export interface StakeholderScores {
  scores: Record<string, { score: number; justification: string }>;
  narrative: string;
  confidence: number;
}

export interface Tension {
  dimension: string;
  agents: Record<string, number>;
  spread: number;
  high_agent: string;
  low_agent: string;
  narrative: string;
}

export interface Evaluation {
  id: number;
  roundId: string;
  stakeholderEvaluations: Record<string, StakeholderScores>;
  aggregatedScores: Record<string, number>;
  overallScore: number;
  bradleyTerryRank?: number;
  tensions: Tension[];
  evaluatedAt: string;
}

export interface SQFDetails {
  qfBase: number;
  pheromoneMod: number;
  pagerankMod: number;
}

export interface Allocation {
  roundId: string;
  amount: number;
  currency: string;
  sqfDetails: SQFDetails | null;
}

export interface ProjectDetail {
  project: Project;
  evaluations: Evaluation[];
  allocations: Allocation[];
}

export interface ResultEntry {
  rank: number;
  project: Project;
  score: number;
  allocation: number;
  sqfDetails: SQFDetails | null;
  attestationStatus?: string;
}

export interface RoundResults {
  round: Round;
  results: ResultEntry[];
  summary: {
    totalPool: number;
    totalAllocated: number;
    projectsFunded: number;
    averageScore: number;
  };
}

export interface UserInfo {
  address: string;
  chainId: number;
  roundsCreated: number;
  applicationsSubmitted: number;
}

export interface PipelineStatus {
  runId: string;
  status: 'running' | 'collecting' | 'evaluating' | 'allocating' | 'attesting' | 'complete' | 'failed';
  progress: { total: number; completed: number; failed: number };
  startedAt: string;
  completedAt?: string;
}
