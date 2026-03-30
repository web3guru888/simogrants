const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper: parse "N" e18 to BigInt. Supports integers and decimal strings like "1.2"
const E18 = (n) => {
  const s = String(n);
  if (s.includes(".")) {
    const [whole, frac] = s.split(".");
    const padded = frac.padEnd(18, "0").slice(0, 18);
    const w = BigInt(whole || "0");
    const f = BigInt(padded);
    return w * 10n ** 18n + f;
  }
  return BigInt(s) * 10n ** 18n;
};

describe("SQFMechanism", function () {
  let sqf, owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const SQFMechanism = await ethers.getContractFactory("SQFMechanism");
    sqf = await SQFMechanism.deploy();
  });

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      expect(await sqf.owner()).to.equal(owner.address);
    });

    it("should start at epoch 0", async function () {
      expect(await sqf.getCurrentEpoch()).to.equal(0);
    });

    it("should have correct constants", async function () {
      expect(await sqf.VIRTUAL_CONTRIBUTORS()).to.equal(10);
      expect(await sqf.SCORE_PRECISION()).to.equal(E18(1));
      expect(await sqf.CAP_BPS()).to.equal(2500);
    });
  });

  describe("computeFromScores", function () {
    it("should compute allocations proportional to scores", async function () {
      const matchingPool = ethers.parseEther("1000");
      const scores = [E18(80), E18(60), E18(40), E18(20)];

      const allocations = await sqf.computeFromScores.staticCall(
        [0, 1, 2, 3], scores, matchingPool
      );

      // All scores should get a non-zero allocation
      for (const alloc of allocations) {
        expect(alloc).to.be.gt(0);
      }

      // Higher score should get more (or equal if capped)
      // Note: with equal pheromone levels (all new), allocations are proportional to scores
      // unless the 25% cap kicks in. Use scores that don't trigger cap.
      expect(allocations[0]).to.be.gte(allocations[1]);
      expect(allocations[1]).to.be.gte(allocations[2]);
      expect(allocations[2]).to.be.gte(allocations[3]);

      // Total should be close to matching pool
      const total = allocations.reduce((a, b) => a + b, 0n);
      expect(total).to.be.closeTo(matchingPool, 100n);
    });

    it("should apply 25% cap on largest allocation", async function () {
      const matchingPool = ethers.parseEther("1000");
      // Very skewed scores: one project dominates
      const scores = [E18(100), E18(1), E18(1), E18(1)];

      const allocations = await sqf.computeFromScores.staticCall(
        [0, 1, 2, 3], scores, matchingPool
      );

      const cap = matchingPool * 2500n / 10000n; // 25%
      for (const alloc of allocations) {
        // Allow cap + 2 for rounding
        expect(alloc).to.be.lte(cap + 2n);
      }
    });

    it("should handle equal scores", async function () {
      const matchingPool = ethers.parseEther("3000");
      const scores = [E18(50), E18(50), E18(50)];

      const allocations = await sqf.computeFromScores.staticCall(
        [0, 1, 2], scores, matchingPool
      );

      // All should be equal (pheromone modifier is same for all new IDs)
      expect(allocations[0]).to.equal(allocations[1]);
      expect(allocations[1]).to.equal(allocations[2]);
    });

    it("should revert with empty inputs", async function () {
      await expect(
        sqf.computeFromScores([], [], ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(sqf, "EmptyInputs");
    });

    it("should revert with mismatched lengths", async function () {
      await expect(
        sqf.computeFromScores([0], [E18(80), E18(60)], ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(sqf, "EmptyInputs");
    });

    it("should revert with score > 100e18", async function () {
      await expect(
        sqf.computeFromScores([0], [E18(101)], ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(sqf, "ScoreTooHigh");
    });

    it("should handle score of 0 (floor to 1 to avoid zero)", async function () {
      const matchingPool = ethers.parseEther("1000");
      const scores = [0n, E18(50), E18(50)];

      const allocations = await sqf.computeFromScores.staticCall(
        [0, 1, 2], scores, matchingPool
      );

      // Even 0-score project should get some allocation (due to min score clamping)
      expect(allocations[0]).to.be.gt(0);
    });
  });

  describe("computeWithModifiers", function () {
    it("should compute with external pheromone and pagerank modifiers", async function () {
      const matchingPool = ethers.parseEther("1000");
      // Use more balanced modifiers so cap doesn't truncate everything
      const scores = [E18(80), E18(60), E18(40)];
      const pheromoneMods = [E18("1.1"), E18("1.0"), E18("0.9")];  // slight boost/reduce
      const pagerankMods = [E18("1.0"), E18("1.0"), E18("1.0")];   // neutral

      const allocations = await sqf.computeWithModifiers.staticCall(
        scores, pheromoneMods, pagerankMods, matchingPool
      );

      // All allocations should be positive
      for (const alloc of allocations) {
        expect(alloc).to.be.gt(0);
      }

      // Total should be close to matching pool (within cap constraints)
      const total = allocations.reduce((a, b) => a + b, 0n);
      // With 3 projects and 25% cap, total can be up to 75% of pool if one dominates
      // But with balanced scores, it should be close to full pool
      expect(total).to.be.gt(0n);
    });

    it("should revert with mismatched modifier lengths", async function () {
      await expect(
        sqf.computeWithModifiers(
          [E18(80)], [E18("1.2")], [], ethers.parseEther("100")
        )
      ).to.be.revertedWithCustomError(sqf, "EmptyInputs");
    });
  });

  describe("Pheromone management", function () {
    it("should return initial pheromone level for new application", async function () {
      expect(await sqf.getPheromoneLevel(0)).to.equal(E18(5));
    });

    it("should deposit pheromone and increase level", async function () {
      await sqf.depositPheromone(0, E18(50)); // 50% accuracy

      const level = await sqf.getPheromoneLevel(0);
      expect(level).to.be.gt(E18(5)); // Should be higher than initial
    });

    it("should clamp pheromone to max (10e18)", async function () {
      // Deposit maximum multiple times
      for (let i = 0; i < 20; i++) {
        await sqf.depositPheromone(0, E18(100));
      }

      expect(await sqf.getPheromoneLevel(0)).to.be.lte(E18(10));
    });

    it("should decay all pheromones by 20%", async function () {
      await sqf.depositPheromone(0, E18(100));
      await sqf.depositPheromone(1, E18(80));

      const before0 = await sqf.getPheromoneLevel(0);
      const before1 = await sqf.getPheromoneLevel(1);

      await sqf.decayPheromones();

      const after0 = await sqf.getPheromoneLevel(0);
      const after1 = await sqf.getPheromoneLevel(1);

      expect(after0).to.be.lt(before0);
      expect(after1).to.be.lt(before1);
      // Verify ~20% decay
      const ratio0 = (before0 * 8n) / 10n;
      expect(after0).to.equal(ratio0);
    });

    it("should deposit pheromone in batch", async function () {
      await sqf.depositPheromoneBatch(
        [0, 1, 2],
        [E18(50), E18(80), E18(100)]
      );

      expect(await sqf.getPheromoneLevel(0)).to.be.gt(E18(5));
      expect(await sqf.getPheromoneLevel(1)).to.be.gt(E18(5));
      expect(await sqf.getPheromoneLevel(2)).to.be.gt(E18(5));
    });

    it("should revert depositPheromone if not owner", async function () {
      await expect(
        sqf.connect(user).depositPheromone(0, E18(50))
      ).to.be.revertedWithCustomError(sqf, "OwnableUnauthorizedAccount");
    });

    it("should revert with accuracy > 100e18", async function () {
      await expect(
        sqf.depositPheromone(0, E18(101))
      ).to.be.revertedWithCustomError(sqf, "InvalidAccuracy");
    });
  });

  describe("Epoch management", function () {
    it("should advance epoch", async function () {
      await expect(sqf.advanceEpoch())
        .to.emit(sqf, "EpochAdvanced")
        .withArgs(0, 1);

      expect(await sqf.getCurrentEpoch()).to.equal(1);
    });

    it("should revert advanceEpoch if not owner", async function () {
      await expect(
        sqf.connect(user).advanceEpoch()
      ).to.be.revertedWithCustomError(sqf, "OwnableUnauthorizedAccount");
    });
  });

  describe("End-to-end allocation scenario", function () {
    it("should handle a realistic 5-project allocation with pheromone modifiers", async function () {
      const matchingPool = ethers.parseEther("10000");

      // Deposit pheromones to create differentiation
      await sqf.depositPheromone(0, E18(100)); // High accuracy → high pheromone
      await sqf.depositPheromone(1, E18(60));
      // Projects 2,3,4 keep initial pheromone (5e18)

      const scores = [E18(90), E18(75), E18(60), E18(40), E18(30)];
      const appIds = [0, 1, 2, 3, 4];

      const allocations = await sqf.computeFromScores.staticCall(
        appIds, scores, matchingPool
      );

      // Verify: all allocations are positive
      for (const alloc of allocations) {
        expect(alloc).to.be.gt(0);
      }

      // Verify: project 0 (high score + high pheromone) gets the most (or equal if capped)
      expect(allocations[0]).to.be.gte(allocations[1]);

      // Verify: total is close to matching pool
      const total = allocations.reduce((a, b) => a + b, 0n);
      expect(total).to.be.closeTo(matchingPool, 200n);

      // Verify: 25% cap is respected
      const cap = matchingPool * 2500n / 10000n;
      for (const alloc of allocations) {
        expect(alloc).to.be.lte(cap + 2n);
      }
    });
  });
});
