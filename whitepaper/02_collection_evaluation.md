# SIMOGRANTS Whitepaper — Part 2: Data Collection & Multi-Agent Evaluation

## 4. Data Collection Layer

### 4.1 Overview

The collector layer gathers project data from 7 sources in parallel using async httpx. Each collector is independent and fault-tolerant — if one source fails, the others still return data. The combined result is a `ProjectProfile` dataclass with a `data_completeness` score (0.0–1.0).

### 4.2 ProjectProfile Schema

```python
@dataclass
class ProjectProfile:
    """Complete project profile assembled from all data sources."""
    project_id: str                    # Unique identifier
    name: str                          # Human-readable name
    description: str                   # Short description
    
    # GitHub data
    github_url: str | None = None
    github_stars: int | None = None
    github_forks: int | None = None
    github_contributors: int | None = None
    github_commits_last_year: int | None = None
    github_open_issues: int | None = None
    github_closed_issues: int | None = None
    github_last_commit_date: str | None = None
    github_languages: dict[str, int] | None = None  # language -> bytes
    github_license: str | None = None
    github_created_at: str | None = None
    github_topics: list[str] | None = None
    commit_velocity: float | None = None  # commits/week avg
    pr_merge_rate: float | None = None    # merged/total PRs
    issue_close_rate: float | None = None  # closed/total issues
    bus_factor: int | None = None          # contributors with >5% commits
    
    # Etherscan / on-chain data
    contract_addresses: list[str] | None = None
    chains_deployed: list[str] | None = None
    total_transactions: int | None = None
    unique_addresses: int | None = None
    contract_verified: bool | None = None
    tvl_usd: float | None = None
    monthly_active_addresses: int | None = None
    
    # DefiLlama data
    defillama_slug: str | None = None
    defillama_tvl: float | None = None
    defillama_tvl_change_7d: float | None = None
    defillama_revenue_30d: float | None = None
    defillama_chains: list[str] | None = None
    defillama_category: str | None = None
    
    # Gitcoin data
    gitcoin_rounds_participated: int | None = None
    gitcoin_total_raised: float | None = None
    gitcoin_unique_donors: int | None = None
    gitcoin_avg_donation: float | None = None
    gitcoin_passport_score: float | None = None
    
    # Snapshot governance data
    snapshot_space: str | None = None
    snapshot_proposals: int | None = None
    snapshot_voters: int | None = None
    snapshot_avg_participation: float | None = None
    
    # Octant data
    octant_epochs_funded: int | None = None
    octant_total_allocation: float | None = None
    octant_unique_supporters: int | None = None
    
    # Package registry data
    npm_weekly_downloads: int | None = None
    pypi_monthly_downloads: int | None = None
    crates_total_downloads: int | None = None
    
    # Computed metadata
    data_completeness: float = 0.0    # 0.0–1.0
    collected_at: str = ""             # ISO 8601 timestamp
    collection_errors: list[str] | None = None  # errors from failed sources
    
    def compute_completeness(self) -> float:
        """Calculate data_completeness as ratio of non-None fields."""
        fields = [f for f in self.__dataclass_fields__ 
                  if f not in ('project_id', 'name', 'description', 
                              'data_completeness', 'collected_at', 'collection_errors')]
        filled = sum(1 for f in fields if getattr(self, f) is not None)
        self.data_completeness = filled / len(fields)
        return self.data_completeness
```

### 4.3 Individual Collectors

Each collector follows this interface:

```python
class BaseCollector(ABC):
    """Base class for all data collectors."""
    
    def __init__(self, api_key: str | None = None):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.api_key = api_key
    
    @abstractmethod
    async def collect(self, identifier: str) -> dict:
        """Collect data for a project. Returns dict of field->value pairs."""
        ...
    
    async def close(self):
        await self.client.aclose()
```

#### 4.3.1 GitHub Collector
- **API:** GitHub REST API v3 + GraphQL API v4
- **Auth:** Personal access token (optional, higher rate limits)
- **Input:** GitHub URL or `owner/repo` string
- **Fields collected:** stars, forks, contributors, commits, issues, PRs, languages, license, topics, commit velocity, PR merge rate, issue close rate, bus factor
- **Rate limit handling:** Respect X-RateLimit headers, backoff on 403
- **Computed fields:**
  - `commit_velocity` = total commits in last 52 weeks / 52
  - `pr_merge_rate` = merged PRs / total PRs
  - `issue_close_rate` = closed issues / total issues
  - `bus_factor` = number of contributors with > 5% of total commits

#### 4.3.2 Etherscan Collector
- **API:** Etherscan API (etherscan.io, basescan.org, arbiscan.io, etc.)
- **Auth:** API key required
- **Input:** Contract address(es) or ENS name
- **Fields:** transaction count, unique addresses, contract verification status, balance
- **Multi-chain:** Support Ethereum, Base, Arbitrum, Optimism, Polygon
- **Computed:** `chains_deployed` list, `total_transactions` across chains

#### 4.3.3 DefiLlama Collector
- **API:** DefiLlama API (open, no auth needed)
- **Base URL:** https://api.llama.fi
- **Endpoints:** `/protocol/{slug}`, `/tvl/{slug}`
- **Input:** DefiLlama slug or project name (fuzzy match)
- **Fields:** TVL, TVL change, revenue, chains, category

#### 4.3.4 Gitcoin Collector
- **API:** Gitcoin Grants Stack indexer API
- **Input:** Project name or address
- **Fields:** rounds participated, total raised, unique donors, average donation
- **Note:** Also check Gitcoin Passport API for passport scores

#### 4.3.5 Snapshot Collector
- **API:** Snapshot GraphQL API (https://hub.snapshot.org/graphql)
- **Input:** Snapshot space name (e.g., "aave.eth")
- **Fields:** proposals count, voters, average participation rate

#### 4.3.6 Octant Collector
- **API:** Octant API (https://backend.mainnet.octant.app)
- **Input:** Project address or name
- **Fields:** epochs funded, total allocation, unique supporters
- **Epochs:** Check epochs 1–5

#### 4.3.7 Package Registry Collector
- **APIs:** npmjs.com, pypi.org, crates.io
- **Input:** Package name(s) associated with the project
- **Fields:** weekly/monthly/total downloads per registry

### 4.4 Collection Orchestrator

```python
class CollectionOrchestrator:
    """Runs all collectors in parallel and merges results."""
    
    def __init__(self, config: dict):
        self.collectors = {
            'github': GitHubCollector(config.get('github_token')),
            'etherscan': EtherscanCollector(config.get('etherscan_key')),
            'defillama': DefiLlamaCollector(),
            'gitcoin': GitcoinCollector(),
            'snapshot': SnapshotCollector(),
            'octant': OctantCollector(),
            'packages': PackageCollector(),
        }
    
    async def collect_project(self, project_input: dict) -> ProjectProfile:
        """
        Collect data for a project from all sources in parallel.
        
        project_input should contain:
        - name: str
        - github_url: str (optional)
        - contract_addresses: list[str] (optional)
        - defillama_slug: str (optional)
        - snapshot_space: str (optional)
        - package_names: dict (optional, e.g. {"npm": "ethers"})
        """
        tasks = []
        for name, collector in self.collectors.items():
            identifier = self._get_identifier(project_input, name)
            if identifier:
                tasks.append(self._collect_with_error_handling(name, collector, identifier))
        
        results = await asyncio.gather(*tasks)
        return self._merge_results(project_input, results)
```

---

## 5. Multi-Agent Evaluation Layer

### 5.1 Overview

Four LLM-powered stakeholder agents evaluate each project independently. Each agent adopts a specific perspective and scores on 3 dimensions (0–100). Results are aggregated via Bradley-Terry pairwise comparison.

### 5.2 Stakeholder Agents

#### 5.2.1 Developer Agent
**Perspective:** Technical quality, code health, developer experience
**Dimensions:**
1. **Code Quality** (0–100): Test coverage, documentation, code review practices, CI/CD, linting
2. **Maintenance Health** (0–100): Commit velocity, issue response time, PR merge rate, bus factor
3. **Security Posture** (0–100): Audit status, vulnerability handling, dependency management, contract verification

**System Prompt Template:**
```
You are a senior blockchain developer evaluating {project_name} for public goods funding.
You have deep expertise in Solidity, Ethereum infrastructure, and open-source development.

Evaluate this project's TECHNICAL MERIT based on the provided data.

Score each dimension 0-100 with detailed justification:
1. Code Quality: Test coverage, documentation, review practices, CI/CD
2. Maintenance Health: Commit velocity, issue response time, PR merge rate, bus factor  
3. Security Posture: Audits, vulnerability handling, dependency management

Be calibrated: 50 = average Ethereum project, 80+ = exceptional, below 30 = concerning.
Provide 2-3 sentences of justification per dimension.

Output as JSON: {
  "code_quality": {"score": int, "justification": str},
  "maintenance_health": {"score": int, "justification": str},
  "security_posture": {"score": int, "justification": str},
  "overall_narrative": str  // 1 paragraph summary
}
```

#### 5.2.2 User Agent
**Perspective:** Adoption, usability, community engagement
**Dimensions:**
1. **Adoption Metrics** (0–100): Active users, transaction volume, TVL growth, download trends
2. **Community Engagement** (0–100): Governance participation, social presence, support responsiveness
3. **User Experience** (0–100): Documentation quality, onboarding flow, API design, error handling

#### 5.2.3 Funder Agent
**Perspective:** Capital efficiency, sustainability, funding history
**Dimensions:**
1. **Capital Efficiency** (0–100): Impact per dollar, operational costs vs output, revenue sustainability
2. **Funding Sustainability** (0–100): Revenue model, diversification of funding, treasury management
3. **Track Record** (0–100): Prior funding usage, milestone delivery, transparency of spending

#### 5.2.4 Ecosystem Agent
**Perspective:** Systemic value, composability, network effects
**Dimensions:**
1. **Composability** (0–100): Integration with other protocols, standards compliance, API quality
2. **Network Effects** (0–100): Dependencies, downstream projects, ecosystem contribution
3. **Mission Alignment** (0–100): Ethereum values alignment, public goods character, decentralization commitment

### 5.3 Evaluation Pipeline

```python
class EvaluationEngine:
    """Runs 4 stakeholder agents and aggregates results."""
    
    STAKEHOLDERS = ['developer', 'user', 'funder', 'ecosystem']
    
    async def evaluate_project(self, profile: ProjectProfile) -> EvaluationResult:
        """Run all 4 stakeholder evaluations + aggregation."""
        # Step 1: Run 4 agents in parallel
        agent_results = await asyncio.gather(*[
            self._run_stakeholder(agent, profile) 
            for agent in self.STAKEHOLDERS
        ])
        
        # Step 2: Pairwise comparison (Bradley-Terry)
        if len(profiles_batch) > 1:
            rankings = self._bradley_terry_aggregate(agent_results, profiles_batch)
        
        # Step 3: Detect tensions
        tensions = self._detect_tensions(agent_results)
        
        # Step 4: Compute final scores
        return self._build_result(agent_results, rankings, tensions)
```

### 5.4 Bradley-Terry Aggregation

For a batch of N projects, each stakeholder agent also performs pairwise comparisons:

```python
def bradley_terry_aggregate(self, comparisons: list[tuple[str, str, float]]) -> dict[str, float]:
    """
    Compute Bradley-Terry rankings from pairwise comparisons.
    
    comparisons: list of (project_a, project_b, p_a_wins)
    where p_a_wins is probability that a > b (0.0 to 1.0)
    
    Returns: dict of project_id -> strength parameter (higher = better)
    
    Uses scipy.optimize.minimize with log-likelihood:
    L = Σ [w_ij * log(p_i / (p_i + p_j)) + w_ji * log(p_j / (p_i + p_j))]
    """
    from scipy.optimize import minimize
    
    projects = list(set(p for comp in comparisons for p in comp[:2]))
    n = len(projects)
    idx = {p: i for i, p in enumerate(projects)}
    
    def neg_log_likelihood(params):
        ll = 0.0
        for a, b, p_a in comparisons:
            i, j = idx[a], idx[b]
            pi = np.exp(params[i])
            pj = np.exp(params[j])
            ll += p_a * np.log(pi / (pi + pj)) + (1 - p_a) * np.log(pj / (pi + pj))
        return -ll
    
    result = minimize(neg_log_likelihood, np.zeros(n), method='L-BFGS-B')
    strengths = np.exp(result.x)
    strengths /= strengths.sum()
    
    return {p: strengths[idx[p]] for p in projects}
```

### 5.5 Tension Detection

```python
def detect_tensions(self, agent_results: dict[str, AgentScores]) -> list[Tension]:
    """
    Detect significant disagreements between stakeholder agents.
    
    A tension exists when:
    - The spread (max - min) across agents for any dimension > 35 points
    - OR two agents disagree by > 40 points on the same dimension
    
    Returns list of Tension objects with:
    - dimension: which score dimension
    - agents: which agents disagree
    - spread: the point spread
    - narrative: LLM-generated explanation of why they disagree
    """
    tensions = []
    dimensions = ['code_quality', 'maintenance_health', 'security_posture',
                   'adoption', 'community', 'ux',
                   'capital_efficiency', 'sustainability', 'track_record',
                   'composability', 'network_effects', 'alignment']
    
    for dim in dimensions:
        scores = {agent: getattr(results[agent], dim, None) 
                  for agent in agent_results if hasattr(results[agent], dim)}
        if len(scores) < 2:
            continue
        spread = max(scores.values()) - min(scores.values())
        if spread > 35:
            tensions.append(Tension(
                dimension=dim,
                agents=scores,
                spread=spread,
                high_agent=max(scores, key=scores.get),
                low_agent=min(scores, key=scores.get),
            ))
    return tensions
```

### 5.6 Structured Output Schema

Each stakeholder agent returns:

```python
@dataclass
class StakeholderEvaluation:
    agent_type: str              # 'developer', 'user', 'funder', 'ecosystem'
    project_id: str
    scores: dict[str, int]       # dimension -> score (0-100)
    justifications: dict[str, str]  # dimension -> text justification
    overall_narrative: str       # 1 paragraph summary
    confidence: float            # 0.0–1.0 based on data_completeness
    evaluated_at: str            # ISO 8601

@dataclass  
class EvaluationResult:
    project_id: str
    stakeholder_evaluations: list[StakeholderEvaluation]  # 4 evaluations
    aggregated_scores: dict[str, float]  # dimension -> weighted score
    overall_score: float                 # 0–100
    bradley_terry_rank: float | None     # if batch mode
    tensions: list[Tension]
    data_completeness: float
    evaluated_at: str
```
