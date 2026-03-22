# SIMOGRANTS Whitepaper — Part 3: Stigmergic QF Mechanism & On-Chain Layer

## 6. Stigmergic Quadratic Funding (SQF)

### 6.1 Overview

Standard Quadratic Funding (Buterin, Hitzig, Weyl 2018) allocates a matching pool proportional to the square of the sum of square roots of individual contributions:

```
QF_allocation_i = (Σ √c_ij)² / Σ_k (Σ √c_kj)²  ×  matching_pool
```

SIMOGRANTS extends this with two modifiers:

```
SQF_allocation_i = QF_allocation_i × Pheromone_Modifier_i × PageRank_Modifier_i
```

Then renormalized so allocations sum to the matching pool.

### 6.2 Standard QF Engine

```python
class QFEngine:
    """Standard Quadratic Funding calculation."""
    
    def calculate(self, contributions: dict[str, list[float]], matching_pool: float) -> dict[str, float]:
        """
        contributions: {project_id: [contribution_1, contribution_2, ...]}
        matching_pool: total matching funds available
        
        Returns: {project_id: allocation}
        """
        qf_scores = {}
        for project, contribs in contributions.items():
            sqrt_sum = sum(math.sqrt(c) for c in contribs)
            qf_scores[project] = sqrt_sum ** 2
        
        total = sum(qf_scores.values())
        if total == 0:
            return {p: matching_pool / len(contributions) for p in contributions}
        
        return {p: (score / total) * matching_pool for p, score in qf_scores.items()}
```

### 6.3 Pheromone Tracker

Inspired by ant colony optimization. Each project carries a pheromone value (0–10) that reflects historical evaluation accuracy:

```python
class PheromoneTracker:
    """Tracks pheromone levels for stigmergic learning."""
    
    INITIAL = 5.0
    MIN = 0.0
    MAX = 10.0
    DECAY_RATE = 0.2     # 20% decay per epoch
    DEPOSIT_RATE = 0.5   # deposit for accurate predictions
    
    def __init__(self):
        self.pheromones: dict[str, float] = {}  # project_id -> level
        self.history: list[dict] = []  # epoch history
    
    def get_level(self, project_id: str) -> float:
        return self.pheromones.get(project_id, self.INITIAL)
    
    def decay_all(self):
        """Apply decay: p = p * (1 - decay_rate). Called once per epoch."""
        for pid in self.pheromones:
            self.pheromones[pid] *= (1 - self.DECAY_RATE)
            self.pheromones[pid] = max(self.MIN, self.pheromones[pid])
    
    def deposit(self, project_id: str, accuracy: float):
        """
        Deposit pheromone based on evaluation accuracy.
        accuracy: 0.0–1.0 (how well past evaluation predicted actual impact)
        deposit = DEPOSIT_RATE * accuracy
        """
        current = self.get_level(project_id)
        deposit = self.DEPOSIT_RATE * accuracy
        self.pheromones[project_id] = min(self.MAX, current + deposit)
    
    def get_modifier(self, project_id: str) -> float:
        """
        Convert pheromone level to allocation modifier.
        Maps [0, 10] → [0.5, 1.5] linearly.
        Projects with high pheromone get up to 1.5x boost.
        Projects with low pheromone get 0.5x penalty.
        """
        level = self.get_level(project_id)
        return 0.5 + (level / 10.0)  # linear map [0,10] → [0.5, 1.5]
```

### 6.4 PageRank Attribution

Uses dependency graph to attribute value to foundational infrastructure:

```python
class PageRankEngine:
    """Dependency-graph PageRank for infrastructure attribution."""
    
    def __init__(self, damping: float = 0.85):
        self.damping = damping
        self.graph = nx.DiGraph()
    
    def build_graph(self, dependencies: list[tuple[str, str]]):
        """
        Build dependency graph.
        dependencies: [(dependent_project, dependency_project), ...]
        Edge from A to B means "A depends on B" (B gets credit).
        """
        for dependent, dependency in dependencies:
            self.graph.add_edge(dependent, dependency)
    
    def compute_pagerank(self) -> dict[str, float]:
        """
        Compute PageRank scores.
        Returns: {project_id: pagerank_score}
        Higher = more projects depend on you (infrastructure value).
        """
        if len(self.graph) == 0:
            return {}
        return nx.pagerank(self.graph, alpha=self.damping)
    
    def get_modifier(self, project_id: str, pagerank_scores: dict[str, float]) -> float:
        """
        Convert PageRank to allocation modifier.
        Maps to [0.8, 1.4] range.
        High PageRank (infrastructure) gets up to 1.4x boost.
        """
        if project_id not in pagerank_scores:
            return 1.0  # neutral for unknown projects
        
        score = pagerank_scores[project_id]
        mean_score = np.mean(list(pagerank_scores.values()))
        
        if mean_score == 0:
            return 1.0
        
        # Normalize: ratio to mean, clamped to [0.8, 1.4]
        ratio = score / mean_score
        modifier = 0.8 + 0.6 * min(ratio / 3.0, 1.0)  # caps at 3x mean
        return max(0.8, min(1.4, modifier))
```

### 6.5 SQF Formula (Combined)

```python
class SQFMechanism:
    """Stigmergic Quadratic Funding: QF × Pheromone × PageRank."""
    
    def __init__(self, config: dict):
        self.qf = QFEngine()
        self.pheromone = PheromoneTracker()
        self.pagerank = PageRankEngine(damping=config.get('damping', 0.85))
        self.matching_pool = config.get('matching_pool', 100000)
    
    def compute_allocation(
        self,
        contributions: dict[str, list[float]],
        dependencies: list[tuple[str, str]],
        evaluation_scores: dict[str, float],
    ) -> dict[str, float]:
        """
        Compute SQF allocation for all projects.
        
        1. Base QF allocation
        2. Apply pheromone modifiers
        3. Apply PageRank modifiers
        4. Renormalize to match pool
        """
        # Step 1: Standard QF
        qf_alloc = self.qf.calculate(contributions, self.matching_pool)
        
        # Step 2: PageRank
        self.pagerank.build_graph(dependencies)
        pr_scores = self.pagerank.compute_pagerank()
        
        # Step 3: Apply modifiers
        sqf_alloc = {}
        for project in qf_alloc:
            base = qf_alloc[project]
            pheromone_mod = self.pheromone.get_modifier(project)
            pagerank_mod = self.pagerank.get_modifier(project, pr_scores)
            sqf_alloc[project] = base * pheromone_mod * pagerank_mod
        
        # Step 4: Renormalize
        total = sum(sqf_alloc.values())
        if total > 0:
            sqf_alloc = {p: (v / total) * self.matching_pool 
                         for p, v in sqf_alloc.items()}
        
        return sqf_alloc
    
    def advance_epoch(self, accuracy_scores: dict[str, float]):
        """
        Advance to next epoch:
        1. Decay all pheromones
        2. Deposit based on accuracy
        """
        self.pheromone.decay_all()
        for project, accuracy in accuracy_scores.items():
            self.pheromone.deposit(project, accuracy)
```

### 6.6 Anti-Goodhart Dimension Rotation

To prevent gaming of specific metrics:

```python
class AntiGoodhartRotation:
    """
    Rotate which evaluation dimensions are active each epoch.
    
    12 total dimensions, 8 active per epoch.
    Random selection seeded by epoch number for reproducibility.
    Projects can't optimize for specific metrics because active set changes.
    """
    
    ALL_DIMENSIONS = [
        'code_quality', 'maintenance_health', 'security_posture',
        'adoption', 'community', 'ux',
        'capital_efficiency', 'sustainability', 'track_record',
        'composability', 'network_effects', 'alignment'
    ]
    
    def __init__(self, active_count: int = 8):
        self.active_count = active_count
    
    def get_active_dimensions(self, epoch: int) -> list[str]:
        """Get active dimensions for this epoch (deterministic)."""
        rng = np.random.RandomState(seed=epoch * 42 + 7)
        indices = rng.choice(len(self.ALL_DIMENSIONS), self.active_count, replace=False)
        return [self.ALL_DIMENSIONS[i] for i in sorted(indices)]
    
    def compute_weighted_score(self, scores: dict[str, float], epoch: int) -> float:
        """Compute weighted score using only active dimensions."""
        active = self.get_active_dimensions(epoch)
        active_scores = [scores[d] for d in active if d in scores]
        if not active_scores:
            return 0.0
        return sum(active_scores) / len(active_scores)
```

### 6.7 Backtesting Engine

```python
class BacktestingEngine:
    """Simulate SQF allocation over historical epochs."""
    
    def run_backtest(
        self,
        historical_data: list[dict],  # list of epoch data
        config: dict,
    ) -> BacktestResult:
        """
        Run multi-epoch simulation.
        
        Each epoch dict contains:
        - contributions: {project: [amounts]}
        - dependencies: [(a, b), ...]
        - actual_impact: {project: float}  # ground truth
        
        Returns: BacktestResult with metrics per epoch
        """
        mechanism = SQFMechanism(config)
        results = []
        
        for epoch_idx, epoch_data in enumerate(historical_data):
            # Compute allocations
            alloc = mechanism.compute_allocation(
                epoch_data['contributions'],
                epoch_data['dependencies'],
                epoch_data.get('evaluation_scores', {}),
            )
            
            # Compare to actual impact
            if 'actual_impact' in epoch_data:
                accuracy = self._compute_accuracy(alloc, epoch_data['actual_impact'])
                mechanism.advance_epoch(accuracy)
            
            results.append({
                'epoch': epoch_idx,
                'allocations': alloc,
                'pheromone_state': dict(mechanism.pheromone.pheromones),
            })
        
        return BacktestResult(epochs=results)
```

---

## 7. On-Chain Layer

### 7.1 Attestation Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SIMOGrantsAttestation
 * @notice Publishes evaluation attestations on Base
 * @dev Each attestation is a hash commitment with Filecoin CID reference
 */
contract SIMOGrantsAttestation {
    struct Attestation {
        bytes32 evaluationHash;    // keccak256 of evaluation JSON
        string filecoinCID;        // IPFS/Filecoin CID of evidence bundle
        uint256 timestamp;
        address attester;
        uint256 epoch;
    }
    
    // project identifier => attestation history
    mapping(bytes32 => Attestation[]) public attestations;
    
    // Epoch tracking
    uint256 public currentEpoch;
    address public owner;
    
    event AttestationPublished(
        bytes32 indexed projectHash,
        bytes32 evaluationHash,
        string filecoinCID,
        uint256 epoch,
        address attester
    );
    
    event EpochAdvanced(uint256 newEpoch);
    
    constructor() {
        owner = msg.sender;
        currentEpoch = 1;
    }
    
    function publishAttestation(
        bytes32 projectHash,
        bytes32 evaluationHash,
        string calldata filecoinCID
    ) external {
        attestations[projectHash].push(Attestation({
            evaluationHash: evaluationHash,
            filecoinCID: filecoinCID,
            timestamp: block.timestamp,
            attester: msg.sender,
            epoch: currentEpoch
        }));
        
        emit AttestationPublished(
            projectHash, evaluationHash, filecoinCID, currentEpoch, msg.sender
        );
    }
    
    function advanceEpoch() external {
        require(msg.sender == owner, "Only owner");
        currentEpoch++;
        emit EpochAdvanced(currentEpoch);
    }
    
    function getAttestationCount(bytes32 projectHash) external view returns (uint256) {
        return attestations[projectHash].length;
    }
    
    function getLatestAttestation(bytes32 projectHash) external view returns (Attestation memory) {
        require(attestations[projectHash].length > 0, "No attestations");
        return attestations[projectHash][attestations[projectHash].length - 1];
    }
}
```

### 7.2 Evidence Bundle Format

Each evaluation produces a JSON evidence bundle uploaded to Filecoin:

```json
{
  "version": "1.0.0",
  "project_id": "uniswap",
  "evaluated_at": "2025-01-15T12:00:00Z",
  "epoch": 1,
  "data_profile": { /* full ProjectProfile */ },
  "stakeholder_evaluations": [
    {
      "agent_type": "developer",
      "scores": {"code_quality": 85, "maintenance_health": 78, "security_posture": 90},
      "justifications": { /* per-dimension */ },
      "overall_narrative": "..."
    }
    // ... 3 more agents
  ],
  "aggregated_scores": { /* dimension -> weighted score */ },
  "tensions": [ /* any detected tensions */ ],
  "sqf_allocation": {
    "qf_base": 5000.00,
    "pheromone_modifier": 1.2,
    "pagerank_modifier": 1.15,
    "final_allocation": 6900.00
  },
  "evaluation_hash": "0x...",
  "metadata": {
    "model": "claude-sonnet-4-20250514",
    "system_version": "1.0.0",
    "data_completeness": 0.72
  }
}
```

### 7.3 Filecoin Upload

```python
class FilecoinUploader:
    """Upload evidence bundles to Filecoin via web3.storage."""
    
    async def upload_bundle(self, evidence: dict) -> str:
        """Upload JSON evidence bundle. Returns CID."""
        content = json.dumps(evidence, indent=2)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.web3.storage/upload",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                content=content,
            )
            response.raise_for_status()
            return response.json()["cid"]
```

### 7.4 On-Chain Publication Flow

```
1. Evaluate project → EvaluationResult
2. Build evidence bundle JSON
3. Upload to Filecoin → CID
4. Compute evaluationHash = keccak256(evidence JSON)
5. Compute projectHash = keccak256(project_id)
6. Call contract.publishAttestation(projectHash, evaluationHash, CID)
7. Return {txHash, CID, evaluationHash}
```

### 7.5 ERC-8004 Compliance

For the "Agents With Receipts" track, attestations follow ERC-8004 patterns:
- Agent identity tied to attestation address
- Evaluation hash is the "receipt" of work performed
- Filecoin CID provides the evidence trail
- Contract events enable off-chain indexing
