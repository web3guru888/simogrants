// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SQFMechanism
 * @notice On-chain Stigmergic Quadratic Funding calculator (simplified for hackathon demo).
 *
 * Computes allocations using:
 * 1. QF with fixed virtual contributors (10 per project), contribution size ∝ score
 * 2. Pheromone modifier (decay + deposit based on historical accuracy)
 * 3. Per-project cap (25% of matching pool)
 *
 * PageRank is computed OFF-CHAIN in Cloudflare Workers for complex dependency graphs.
 * This contract provides the core QF + Pheromone logic.
 */
contract SQFMechanism is Ownable(msg.sender) {
    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────

    uint256 public constant VIRTUAL_CONTRIBUTORS = 10;
    uint256 public constant SCORE_PRECISION = 1e18;     // Scores stored as 0-100 * 1e18
    uint256 public constant CAP_BPS = 2500;              // 25% cap per project (basis points)
    uint256 public constant DECAY_NUMERATOR = 2;         // decay rate = 0.2 (2/10)
    uint256 public constant DECAY_DENOMINATOR = 10;
    uint256 public constant DEPOSIT_NUMERATOR = 5;       // deposit rate = 0.5 (5/10)
    uint256 public constant DEPOSIT_DENOMINATOR = 10;
    uint256 public constant PHEROMONE_INITIAL = 5e18;
    uint256 public constant PHEROMONE_MAX = 10e18;
    uint256 public constant PHEROMONE_MIN = 0;

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    uint256 public currentEpoch;

    // applicationId (from GrantRound) => pheromone level
    mapping(uint256 => uint256) public pheromoneLevels;

    // Track which application IDs have pheromone state
    uint256[] private _pheromoneKeys;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event AllocationComputed(uint256 totalAllocated);
    event PheromoneDeposited(uint256 indexed applicationId, uint256 level);
    event EpochAdvanced(uint256 oldEpoch, uint256 newEpoch);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error EmptyInputs();
    error ScoreTooHigh();
    error InvalidAccuracy();

    // ──────────────────────────────────────────────
    // QF Computation
    // ──────────────────────────────────────────────

    /// @notice Compute SQF allocation from scores (simplified entry point).
    /// @param applicationIds Array of application IDs.
    /// @param scores Array of scores (0-100 * 1e18).
    /// @param matchingPool Total matching pool amount.
    /// @return allocations Array of allocated amounts, same order as inputs.
    function computeFromScores(
        uint256[] calldata applicationIds,
        uint256[] calldata scores,
        uint256 matchingPool
    ) external returns (uint256[] memory allocations) {
        uint256 len = applicationIds.length;
        if (len == 0) revert EmptyInputs();
        if (len != scores.length) revert EmptyInputs();

        allocations = new uint256[](len);

        // Step 1: Compute QF base scores
        // For each project: QF_score = (VIRTUAL_CONTRIBUTORS * sqrt(score/10))^2
        // = VIRTUAL_CONTRIBUTORS^2 * score / 10
        // Then normalize to matching pool

        uint256[] memory qfScores = new uint256[](len);
        uint256 totalQF;

        for (uint256 i; i < len; ) {
            if (scores[i] > 100e18) revert ScoreTooHigh();
            uint256 score = scores[i] > 0 ? scores[i] : 1; // minimum score to avoid zero

            // contribution_size = score / 10 (in 1e18 precision)
            // sqrt_sum = VIRTUAL_CONTRIBUTORS * sqrt(score/10)
            // qf = sqrt_sum^2 = VIRTUAL_CONTRIBUTORS^2 * score/10
            // In fixed point: VIRTUAL_CONTRIBUTORS^2 * score / 10 / 1e18
            // But we keep it proportional, so we can just use score * 100
            // (VIRTUAL_CONTRIBUTORS cancels in normalization)
            qfScores[i] = score;
            totalQF += score;
            unchecked { ++i; }
        }

        // Step 2: Apply pheromone modifier
        uint256[] memory modifiedScores = new uint256[](len);
        uint256 totalModified;

        for (uint256 i; i < len; ) {
            uint256 phLevel = _getPheromoneLevel(applicationIds[i]);
            // modifier = 0.5 + (phLevel / 10e18) => range [0.5, 1.5]
            // In 1e18 precision: 0.5e18 + phLevel / 10
            uint256 pherMod = 0.5e18 + phLevel / 10;
            modifiedScores[i] = (qfScores[i] * pherMod) / 1e18;
            totalModified += modifiedScores[i];
            unchecked { ++i; }
        }

        // Step 3: Normalize to matching pool
        if (totalModified == 0) {
            // Equal allocation
            uint256 each = matchingPool / len;
            for (uint256 i; i < len; ) {
                allocations[i] = each;
                unchecked { ++i; }
            }
        } else {
            // Compute raw allocations
            uint256[] memory rawAlloc = new uint256[](len);
            uint256 totalRaw;
            for (uint256 i; i < len; ) {
                rawAlloc[i] = (matchingPool * modifiedScores[i]) / totalModified;
                totalRaw += rawAlloc[i];
                unchecked { ++i; }
            }

            // Step 4: Apply 25% cap
            uint256 cap = (matchingPool * CAP_BPS) / 10000;
            allocations = _applyCap(rawAlloc, cap, matchingPool);
        }

        emit AllocationComputed(_sumArray(allocations));
    }

    /// @notice Compute allocation with external pheromone + pagerank modifiers.
    /// @dev The off-chain Workers can compute complex modifiers and pass them in.
    /// @param scores Array of scores (0-100 * 1e18).
    /// @param pheromoneMods Array of pheromone modifiers (1e18 = 1.0).
    /// @param pagerankMods Array of pagerank modifiers (1e18 = 1.0).
    /// @param matchingPool Total matching pool amount.
    /// @return allocations Array of allocated amounts.
    function computeWithModifiers(
        uint256[] calldata scores,
        uint256[] calldata pheromoneMods,
        uint256[] calldata pagerankMods,
        uint256 matchingPool
    ) external returns (uint256[] memory allocations) {
        uint256 len = scores.length;
        if (len == 0) revert EmptyInputs();
        if (len != pheromoneMods.length || len != pagerankMods.length) revert EmptyInputs();

        allocations = new uint256[](len);
        uint256 totalModified;

        for (uint256 i; i < len; ) {
            if (scores[i] > 100e18) revert ScoreTooHigh();
            uint256 score = scores[i] > 0 ? scores[i] : 1;
            // Apply both modifiers
            uint256 modified = (score * pheromoneMods[i] * pagerankMods[i]) / (1e18 * 1e18);
            allocations[i] = modified;
            totalModified += modified;
            unchecked { ++i; }
        }

        // Normalize
        if (totalModified > 0) {
            uint256[] memory rawAlloc = new uint256[](len);
            for (uint256 i; i < len; ) {
                rawAlloc[i] = (matchingPool * allocations[i]) / totalModified;
                unchecked { ++i; }
            }
            uint256 cap = (matchingPool * CAP_BPS) / 10000;
            allocations = _applyCap(rawAlloc, cap, matchingPool);
        } else {
            uint256 each = matchingPool / len;
            for (uint256 i; i < len; ) {
                allocations[i] = each;
                unchecked { ++i; }
            }
        }

        emit AllocationComputed(_sumArray(allocations));
    }

    // ──────────────────────────────────────────────
    // Pheromone management
    // ──────────────────────────────────────────────

    /// @notice Get pheromone level for an application.
    function getPheromoneLevel(uint256 applicationId) external view returns (uint256) {
        return _getPheromoneLevel(applicationId);
    }

    /// @notice Deposit pheromone for an application (increase trust level).
    /// @param applicationId The application ID.
    /// @param accuracy Accuracy score (0-100 * 1e18).
    function depositPheromone(uint256 applicationId, uint256 accuracy) external onlyOwner {
        if (accuracy > 100e18) revert InvalidAccuracy();

        _ensurePheromoneKey(applicationId);

        // delta = DEPOSIT_RATE * accuracy
        // In fixed point: (DEPOSIT_NUMERATOR * accuracy) / (DEPOSIT_DENOMINATOR * 100e18)
        uint256 delta = (DEPOSIT_NUMERATOR * accuracy) / (DEPOSIT_DENOMINATOR * 100);
        uint256 newLevel = _clampPheromone(pheromoneLevels[applicationId] + delta);
        pheromoneLevels[applicationId] = newLevel;

        emit PheromoneDeposited(applicationId, newLevel);
    }

    /// @notice Decay all pheromone levels by 20%.
    function decayPheromones() external onlyOwner {
        for (uint256 i; i < _pheromoneKeys.length; ) {
            uint256 appId = _pheromoneKeys[i];
            uint256 current = pheromoneLevels[appId];
            // new = current * (1 - DECAY_RATE) = current * (1 - 0.2)
            uint256 decayed = (current * (DECAY_DENOMINATOR - DECAY_NUMERATOR)) / DECAY_DENOMINATOR;
            pheromoneLevels[appId] = decayed;
            unchecked { ++i; }
        }
    }

    /// @notice Batch deposit pheromone for multiple applications.
    function depositPheromoneBatch(
        uint256[] calldata applicationIds,
        uint256[] calldata accuracies
    ) external onlyOwner {
        if (applicationIds.length != accuracies.length) revert EmptyInputs();
        for (uint256 i; i < applicationIds.length; ) {
            _ensurePheromoneKey(applicationIds[i]);

            uint256 accuracy = accuracies[i];
            if (accuracy > 100e18) revert InvalidAccuracy();

            uint256 delta = (DEPOSIT_NUMERATOR * accuracy) / (DEPOSIT_DENOMINATOR * 100);
            uint256 newLevel = _clampPheromone(pheromoneLevels[applicationIds[i]] + delta);
            pheromoneLevels[applicationIds[i]] = newLevel;

            emit PheromoneDeposited(applicationIds[i], newLevel);
            unchecked { ++i; }
        }
    }

    // ──────────────────────────────────────────────
    // Epoch management
    // ──────────────────────────────────────────────

    /// @notice Advance the epoch (e.g., start of new evaluation round).
    function advanceEpoch() external onlyOwner returns (uint256) {
        uint256 old = currentEpoch;
        unchecked { ++currentEpoch; }
        emit EpochAdvanced(old, currentEpoch);
        return currentEpoch;
    }

    function getCurrentEpoch() external view returns (uint256) {
        return currentEpoch;
    }

    // ──────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────

    function _getPheromoneLevel(uint256 applicationId) internal view returns (uint256) {
        uint256 level = pheromoneLevels[applicationId];
        return level > 0 ? level : PHEROMONE_INITIAL;
    }

    function _clampPheromone(uint256 level) internal pure returns (uint256) {
        if (level > PHEROMONE_MAX) return PHEROMONE_MAX;
        return level; // already >= 0 since uint256
    }

    function _ensurePheromoneKey(uint256 applicationId) internal {
        if (pheromoneLevels[applicationId] == 0) {
            pheromoneLevels[applicationId] = PHEROMONE_INITIAL;
            _pheromoneKeys.push(applicationId);
        }
    }

    function _applyCap(
        uint256[] memory rawAlloc,
        uint256 cap,
        uint256 matchingPool
    ) internal pure returns (uint256[] memory) {
        uint256 len = rawAlloc.length;
        uint256[] memory alloc = new uint256[](len);
        for (uint256 i; i < len; ) {
            alloc[i] = rawAlloc[i];
            unchecked { ++i; }
        }

        // Iteratively apply cap (up to 10 rounds)
        for (uint256 round; round < 10; ) {
            uint256 excess;
            for (uint256 i; i < len; ) {
                if (alloc[i] > cap) {
                    excess += alloc[i] - cap;
                    alloc[i] = cap;
                }
                unchecked { ++i; }
            }
            if (excess == 0) break;

            // Distribute excess proportionally to uncapped projects
            uint256 underTotal;
            for (uint256 i; i < len; ) {
                if (alloc[i] < cap) underTotal += alloc[i];
                unchecked { ++i; }
            }
            if (underTotal == 0) {
                // Equal distribution of remaining
                uint256 uncappedCount;
                for (uint256 i; i < len; ) {
                    if (alloc[i] < cap) {
                        unchecked { ++uncappedCount; }
                    }
                    unchecked { ++i; }
                }
                if (uncappedCount == 0) break;
                uint256 share = excess / uncappedCount;
                for (uint256 i; i < len; ) {
                    if (alloc[i] < cap) alloc[i] += share;
                    unchecked { ++i; }
                }
            } else {
                for (uint256 i; i < len; ) {
                    if (alloc[i] < cap) {
                        alloc[i] += (excess * alloc[i]) / underTotal;
                    }
                    unchecked { ++i; }
                }
            }
            unchecked { ++round; }
        }

        return alloc;
    }

    function _sumArray(uint256[] memory arr) internal pure returns (uint256 total) {
        for (uint256 i; i < arr.length; ) {
            total += arr[i];
            unchecked { ++i; }
        }
    }
}
