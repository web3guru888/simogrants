import type {
  Round, Project, Application, RoundDetail, ProjectDetail,
  RoundResults, UserInfo, PipelineStatus, Evaluation, SQFDetails,
  Allocation,
} from './types';

// --- Mock Data ---

const MOCK_ROUNDS: Round[] = [
  {
    id: 'round-001',
    title: 'Ethereum Infrastructure Round 1',
    description: 'Funding critical Ethereum infrastructure projects including client diversity, tooling, and protocol research. This round focuses on foundational layer improvements that benefit the entire ecosystem.',
    creatorAddress: '0x1234567890abcdef1234567890abcdef12345678',
    status: 'active',
    matchingPool: 100000,
    currency: 'USDC',
    chain: 'base',
    applicationDeadline: '2026-04-15T00:00:00Z',
    maxApplications: 50,
    applicationsCount: 12,
    contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    createdAt: '2026-03-25T00:00:00Z',
    updatedAt: '2026-03-30T00:00:00Z',
  },
  {
    id: 'round-002',
    title: 'DeFi Innovation Sprint',
    description: 'Supporting novel DeFi primitives, cross-chain bridges, and security tooling. Open to teams building the next generation of decentralized finance protocols.',
    creatorAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    status: 'funded',
    matchingPool: 75000,
    currency: 'USDC',
    chain: 'base',
    applicationDeadline: '2026-03-20T00:00:00Z',
    maxApplications: 30,
    applicationsCount: 18,
    contractAddress: '0x9876543210abcdef9876543210abcdef98765432',
    createdAt: '2026-03-10T00:00:00Z',
    updatedAt: '2026-03-28T00:00:00Z',
  },
  {
    id: 'round-003',
    title: 'Open Source Developer Tooling',
    description: 'Empowering developers with better tools, frameworks, and educational resources. From IDEs to testing frameworks to documentation generators.',
    creatorAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    status: 'closed',
    matchingPool: 50000,
    currency: 'USDC',
    chain: 'base',
    applicationDeadline: '2026-03-01T00:00:00Z',
    maxApplications: 25,
    applicationsCount: 25,
    contractAddress: '0xfedcba0987654321fedcba0987654321fedcba09',
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
  },
];

const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-001',
    name: 'OpenZeppelin Contracts',
    description: 'Industry-standard library for secure smart contract development. Provides battle-tested implementations of ERC standards, access control, proxies, and utilities.',
    website: 'https://openzeppelin.com',
    githubUrl: 'https://github.com/OpenZeppelin/openzeppelin-contracts',
    teamSize: 8,
    category: 'developer-tooling',
    createdBy: '0xabcdef1234567890abcdef1234567890abcdef12',
    overallScore: 92.3,
    totalFundingReceived: 25000,
    createdAt: '2026-03-10T00:00:00Z',
  },
  {
    id: 'proj-002',
    name: 'Etherscan V2',
    description: 'Next-generation blockchain explorer with AI-powered transaction analysis, smart contract verification, and multi-chain support.',
    website: 'https://etherscan.io',
    githubUrl: 'https://github.com/etherscan',
    teamSize: 12,
    category: 'infrastructure',
    createdBy: '0x1234567890abcdef1234567890abcdef12345678',
    overallScore: 87.1,
    totalFundingReceived: 18000,
    createdAt: '2026-03-08T00:00:00Z',
  },
  {
    id: 'proj-003',
    name: 'DeFi Safety Suite',
    description: 'Comprehensive security auditing toolkit for DeFi protocols. Includes static analysis, formal verification, and automated exploit detection.',
    website: 'https://defisafety.org',
    githubUrl: 'https://github.com/defisafety',
    teamSize: 5,
    category: 'defi',
    createdBy: '0x9876543210fedcba9876543210fedcba98765432',
    overallScore: 85.6,
    totalFundingReceived: 15000,
    createdAt: '2026-03-12T00:00:00Z',
  },
  {
    id: 'proj-004',
    name: 'CrossChain Bridge Protocol',
    description: 'Trustless cross-chain bridge using optimistic rollup verification. Enables seamless asset transfers between Ethereum, Base, and other L2s.',
    website: 'https://crosschain.example.com',
    githubUrl: 'https://github.com/crosschain-bridge',
    teamSize: 6,
    category: 'infrastructure',
    createdBy: '0xabcdef1234567890abcdef1234567890abcdef12',
    overallScore: 79.8,
    totalFundingReceived: 12000,
    createdAt: '2026-03-14T00:00:00Z',
  },
  {
    id: 'proj-005',
    name: 'Governance Dashboard',
    description: 'Unified governance interface for DAOs. Aggregate proposals from Snapshot, Tally, and on-chain governance into a single actionable dashboard.',
    website: 'https://govdash.example.com',
    githubUrl: 'https://github.com/gov-dash',
    teamSize: 4,
    category: 'governance',
    createdBy: '0x1234567890abcdef1234567890abcdef12345678',
    overallScore: 74.2,
    totalFundingReceived: 10000,
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'proj-006',
    name: 'Web3 Academy',
    description: 'Interactive learning platform for blockchain development. Hands-on coding exercises, smart contract workshops, and certification programs.',
    website: 'https://web3academy.example.com',
    githubUrl: 'https://github.com/web3-academy',
    teamSize: 3,
    category: 'education',
    createdBy: '0x9876543210fedcba9876543210fedcba98765432',
    overallScore: 71.5,
    totalFundingReceived: 8000,
    createdAt: '2026-03-16T00:00:00Z',
  },
];

const MOCK_APPLICATIONS: Record<string, Application[]> = {
  'round-001': [
    { id: 'app-001', projectId: 'proj-001', projectName: 'OpenZeppelin Contracts', status: 'evaluated', overallScore: 92.3, appliedAt: '2026-03-26T00:00:00Z', evaluatedAt: '2026-03-30T00:00:00Z' },
    { id: 'app-002', projectId: 'proj-002', projectName: 'Etherscan V2', status: 'evaluated', overallScore: 87.1, appliedAt: '2026-03-26T00:00:00Z', evaluatedAt: '2026-03-30T00:00:00Z' },
    { id: 'app-003', projectId: 'proj-003', projectName: 'DeFi Safety Suite', status: 'evaluated', overallScore: 85.6, appliedAt: '2026-03-27T00:00:00Z', evaluatedAt: '2026-03-30T00:00:00Z' },
    { id: 'app-004', projectId: 'proj-004', projectName: 'CrossChain Bridge Protocol', status: 'evaluated', overallScore: 79.8, appliedAt: '2026-03-27T00:00:00Z', evaluatedAt: '2026-03-30T00:00:00Z' },
    { id: 'app-005', projectId: 'proj-005', projectName: 'Governance Dashboard', status: 'submitted', appliedAt: '2026-03-28T00:00:00Z' },
    { id: 'app-006', projectId: 'proj-006', projectName: 'Web3 Academy', status: 'submitted', appliedAt: '2026-03-28T00:00:00Z' },
  ],
  'round-002': [
    { id: 'app-007', projectId: 'proj-003', projectName: 'DeFi Safety Suite', status: 'funded', overallScore: 85.6, appliedAt: '2026-03-12T00:00:00Z', evaluatedAt: '2026-03-25T00:00:00Z' },
    { id: 'app-008', projectId: 'proj-004', projectName: 'CrossChain Bridge Protocol', status: 'funded', overallScore: 79.8, appliedAt: '2026-03-13T00:00:00Z', evaluatedAt: '2026-03-25T00:00:00Z' },
    { id: 'app-009', projectId: 'proj-005', projectName: 'Governance Dashboard', status: 'funded', overallScore: 74.2, appliedAt: '2026-03-14T00:00:00Z', evaluatedAt: '2026-03-25T00:00:00Z' },
  ],
  'round-003': [
    { id: 'app-010', projectId: 'proj-001', projectName: 'OpenZeppelin Contracts', status: 'funded', overallScore: 92.3, appliedAt: '2026-02-16T00:00:00Z', evaluatedAt: '2026-03-05T00:00:00Z' },
    { id: 'app-011', projectId: 'proj-006', projectName: 'Web3 Academy', status: 'funded', overallScore: 71.5, appliedAt: '2026-02-17T00:00:00Z', evaluatedAt: '2026-03-05T00:00:00Z' },
  ],
};

function makeEvaluations(projectId: string): Evaluation[] {
  return [{
    id: 1,
    roundId: 'round-001',
    stakeholderEvaluations: {
      developer: {
        scores: {
          code_quality: { score: 90, justification: 'Excellent code structure and test coverage' },
          innovation: { score: 85, justification: 'Novel approach to contract upgradability' },
          impact: { score: 92, justification: 'Used by thousands of projects' },
        },
        narrative: 'Strong technical project with excellent code quality. Well-maintained repository with comprehensive testing. The project has become a de facto standard in the ecosystem.',
        confidence: 0.92,
      },
      user: {
        scores: {
          code_quality: { score: 78, justification: 'Good documentation but learning curve' },
          innovation: { score: 80, justification: 'Solid but incremental improvements' },
          impact: { score: 88, justification: 'Very high adoption rate' },
        },
        narrative: 'Widely adopted by developers. Documentation could be improved for newcomers but overall a very valuable tool for the ecosystem.',
        confidence: 0.75,
      },
      funder: {
        scores: {
          code_quality: { score: 92, justification: 'Production-grade quality' },
          innovation: { score: 78, justification: 'Mature, less experimental' },
          impact: { score: 95, justification: 'Critical infrastructure' },
        },
        narrative: 'Essential infrastructure for the Ethereum ecosystem. Strong track record, significant TVS secured through contracts built on this library.',
        confidence: 0.95,
      },
      ecosystem: {
        scores: {
          code_quality: { score: 85, justification: 'Open source, well-governed' },
          innovation: { score: 72, justification: 'Standardizing rather than innovating' },
          impact: { score: 94, justification: 'Foundational for ecosystem growth' },
        },
        narrative: 'The project has enabled thousands of other projects to launch safely. Its standards have shaped best practices in smart contract development.',
        confidence: 0.88,
      },
    },
    aggregatedScores: {
      code_quality: 86.3,
      innovation: 78.8,
      impact: 92.3,
    },
    overallScore: 85.8,
    bradleyTerryRank: 1,
    tensions: [
      {
        dimension: 'innovation',
        agents: { developer: 85, ecosystem: 72 },
        spread: 13,
        high_agent: 'developer',
        low_agent: 'ecosystem',
        narrative: 'Developers see more novelty in the implementation approach than ecosystem reviewers. This tension reflects the gap between technical appreciation and perceived novelty.',
      },
    ],
    evaluatedAt: '2026-03-30T00:00:00Z',
  }];
}

function makeAllocations(projectId: string): Allocation[] {
  return [{
    roundId: 'round-001',
    amount: 25000,
    currency: 'USDC',
    sqfDetails: { qfBase: 20000, pheromoneMod: 1.15, pagerankMod: 1.08 },
  }];
}

// --- Simulated delay ---
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- Mock API functions ---

export const mockApi = {
  // Auth
  async getNonce(): Promise<{ nonce: string; message: string }> {
    await delay(300);
    return {
      nonce: 'mock-nonce-' + Date.now(),
      message: 'simogrants.com wants you to sign in with your Ethereum account:\n0xMockAddress\n\nSign this message to verify your identity.\n\nNonce: mock-nonce-' + Date.now(),
    };
  },

  async verifySignature(_message: string, _signature: string): Promise<{ token: string; address: string; chainId: number }> {
    await delay(500);
    return { token: 'mock-jwt-token', address: '0x1234567890abcdef1234567890abcdef12345678', chainId: 84532 };
  },

  async getMe(): Promise<UserInfo> {
    await delay(200);
    return {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 84532,
      roundsCreated: 2,
      applicationsSubmitted: 1,
    };
  },

  async logout(): Promise<void> {
    await delay(200);
  },

  // Rounds
  async getRounds(params?: { status?: string; sort?: string; limit?: number; offset?: number }): Promise<{ rounds: Round[]; total: number }> {
    await delay(400);
    let rounds = [...MOCK_ROUNDS];
    if (params?.status) {
      rounds = rounds.filter(r => r.status === params.status);
    }
    return { rounds, total: rounds.length };
  },

  async getRound(id: string): Promise<RoundDetail> {
    await delay(500);
    const round = MOCK_ROUNDS.find(r => r.id === id);
    if (!round) throw new Error('Round not found');
    const applications = MOCK_APPLICATIONS[id] || [];
    return {
      round,
      applications,
      statistics: {
        totalApplications: applications.length,
        totalMatchingPool: round.matchingPool,
        allocated: round.status === 'funded' ? round.matchingPool * 0.85 : 0,
        averageScore: applications.reduce((sum, a) => sum + (a.overallScore || 0), 0) / (applications.filter(a => a.overallScore).length || 1),
      },
    };
  },

  async createRound(data: Partial<Round>): Promise<Round> {
    await delay(600);
    const newRound: Round = {
      id: 'round-' + Date.now(),
      title: data.title || 'New Round',
      description: data.description || '',
      creatorAddress: '0x1234567890abcdef1234567890abcdef12345678',
      status: 'accepting',
      matchingPool: data.matchingPool || 0,
      currency: data.currency || 'USDC',
      chain: data.chain || 'base',
      applicationDeadline: data.applicationDeadline || '2026-05-01T00:00:00Z',
      maxApplications: data.maxApplications || 50,
      applicationsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_ROUNDS.push(newRound);
    return newRound;
  },

  // Projects
  async getProjects(params?: { roundId?: string; status?: string }): Promise<{ projects: Project[]; total: number }> {
    await delay(400);
    let projects = [...MOCK_PROJECTS];
    return { projects, total: projects.length };
  },

  async getProject(id: string): Promise<ProjectDetail> {
    await delay(500);
    const project = MOCK_PROJECTS.find(p => p.id === id);
    if (!project) throw new Error('Project not found');
    return {
      project,
      evaluations: makeEvaluations(id),
      allocations: makeAllocations(id),
    };
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    await delay(500);
    const newProject: Project = {
      id: 'proj-' + Date.now(),
      name: data.name || 'New Project',
      description: data.description || '',
      website: data.website,
      githubUrl: data.githubUrl,
      teamSize: data.teamSize || 1,
      category: data.category || 'other',
      createdBy: '0x1234567890abcdef1234567890abcdef12345678',
      createdAt: new Date().toISOString(),
    };
    MOCK_PROJECTS.push(newProject);
    return newProject;
  },

  async applyToRound(roundId: string, projectId: string): Promise<{ applicationId: string; roundId: string; projectId: string; status: string; appliedAt: string }> {
    await delay(500);
    return {
      applicationId: 'app-' + Date.now(),
      roundId,
      projectId,
      status: 'submitted',
      appliedAt: new Date().toISOString(),
    };
  },

  // Results
  async getRoundResults(id: string): Promise<RoundResults> {
    await delay(600);
    const round = MOCK_ROUNDS.find(r => r.id === id);
    if (!round) throw new Error('Round not found');
    const apps = MOCK_APPLICATIONS[id] || [];
    const evaluated = apps.filter(a => a.overallScore).sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
    const results: RoundResults['results'] = evaluated.map((app, i) => ({
      rank: i + 1,
      project: MOCK_PROJECTS.find(p => p.id === app.projectId) || { id: app.projectId, name: app.projectName, description: '', teamSize: 0, category: 'other', createdBy: '', createdAt: '' },
      score: app.overallScore || 0,
      allocation: round.matchingPool * (1 - i * 0.12) * 0.35,
      sqfDetails: { qfBase: round.matchingPool * (1 - i * 0.12) * 0.3, pheromoneMod: 1 + (Math.random() * 0.3), pagerankMod: 1 + (Math.random() * 0.2) },
      attestationStatus: round.status === 'funded' ? 'attested' : 'pending',
    }));
    return {
      round,
      results,
      summary: {
        totalPool: round.matchingPool,
        totalAllocated: results.reduce((s, r) => s + r.allocation, 0),
        projectsFunded: results.length,
        averageScore: results.reduce((s, r) => s + r.score, 0) / (results.length || 1),
      },
    };
  },

  // Evaluation pipeline
  async triggerEvaluation(roundId: string): Promise<PipelineStatus> {
    await delay(800);
    return {
      runId: 'pipeline-' + Date.now(),
      status: 'running',
      progress: { total: 6, completed: 0, failed: 0 },
      startedAt: new Date().toISOString(),
    };
  },

  async getPipelineStatus(runId: string): Promise<PipelineStatus> {
    await delay(300);
    return {
      runId,
      status: 'complete',
      progress: { total: 6, completed: 6, failed: 0 },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  },
};
