const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Helper: parse "N" e18 to BigInt
const E18 = (n) => BigInt(n) * 10n ** 18n;

describe("GrantRound", function () {
  let round, factory, owner, applicant1, applicant2, evaluator;
  const METADATA_URI = "ipfs://QmTestRoundMetadata";
  const APP_URI_1 = "ipfs://QmProject1";
  const APP_URI_2 = "ipfs://QmProject2";

  beforeEach(async function () {
    [owner, applicant1, applicant2, evaluator] = await ethers.getSigners();

    // Deploy GrantRound implementation
    const GrantRoundImpl = await ethers.getContractFactory("GrantRound");
    const implementation = await GrantRoundImpl.deploy();

    // Deploy a mock factory (just an EOA for testing)
    factory = owner;

    // Clone the implementation manually (since we don't need full factory logic here)
    // Actually, let's deploy a factory to test properly
    const GrantFactory = await ethers.getContractFactory("GrantFactory");
    const factoryContract = await GrantFactory.deploy(await implementation.getAddress());
    factory = factoryContract;

    // Create a round
    const deadline = (await time.latest()) + 7 * 24 * 60 * 60;
    const votingDeadline = deadline + 7 * 24 * 60 * 60;
    const tx = await factoryContract.createRound(
      METADATA_URI, ethers.parseEther("1000"), ethers.ZeroAddress,
      deadline, votingDeadline
    );
    const receipt = await tx.wait();
    const event = receipt.logs
      .map(log => {
        try { return factoryContract.interface.parseLog(log); } catch { return null; }
      })
      .find(e => e?.name === "RoundCreated");
    const roundAddr = event.args.roundAddress;

    round = await ethers.getContractAt("GrantRound", roundAddr);
  });

  describe("Initialization", function () {
    it("should set owner to the round creator", async function () {
      expect(await round.owner()).to.equal(owner.address);
    });

    it("should set factory address", async function () {
      expect(await round.factory()).to.equal(await factory.getAddress());
    });

    it("should set metadataURI", async function () {
      expect(await round.metadataURI()).to.equal(METADATA_URI);
    });

    it("should start in Accepting status", async function () {
      expect(await round.getStatus()).to.equal(0); // Accepting
    });

    it("should revert on double initialization", async function () {
      await expect(
        round.initialize(
          owner.address, await factory.getAddress(), METADATA_URI,
          (await time.latest()) + 86400, (await time.latest()) + 172800,
          ethers.ZeroAddress
        )
      ).to.be.reverted;
    });
  });

  describe("submitApplication", function () {
    it("should accept an application", async function () {
      await expect(round.connect(applicant1).submitApplication(APP_URI_1))
        .to.emit(round, "Applied")
        .withArgs(applicant1.address, 0);

      expect(await round.getApplicationCount()).to.equal(1);
    });

    it("should store application data correctly", async function () {
      await round.connect(applicant1).submitApplication(APP_URI_1);
      const app = await round.getApplication(0);

      expect(app.applicant).to.equal(applicant1.address);
      expect(app.metadataURI).to.equal(APP_URI_1);
      expect(app.exists).to.be.true;
      expect(app.score).to.equal(0);
      expect(app.allocation).to.equal(0);
      expect(app.funded).to.be.false;
    });

    it("should allow multiple applications from different addresses", async function () {
      await round.connect(applicant1).submitApplication(APP_URI_1);
      await round.connect(applicant2).submitApplication(APP_URI_2);

      expect(await round.getApplicationCount()).to.equal(2);
    });

    it("should revert if same address applies twice", async function () {
      await round.connect(applicant1).submitApplication(APP_URI_1);
      await expect(
        round.connect(applicant1).submitApplication(APP_URI_2)
      ).to.be.revertedWithCustomError(round, "AlreadyApplied");
    });

    it("should revert with empty metadataURI", async function () {
      await expect(
        round.connect(applicant1).submitApplication("")
      ).to.be.revertedWithCustomError(round, "InvalidApplication");
    });

    it("should track applicant-to-id mapping", async function () {
      await round.connect(applicant1).submitApplication(APP_URI_1);
      expect(await round.getApplicationId(applicant1.address)).to.equal(0);
    });

    it("should return max uint for unknown applicant", async function () {
      const id = await round.getApplicationId(applicant1.address);
      expect(id).to.equal(ethers.MaxUint256);
    });
  });

  describe("recordScore (evaluate)", function () {
    beforeEach(async function () {
      await round.connect(applicant1).submitApplication(APP_URI_1);
      await round.connect(applicant2).submitApplication(APP_URI_2);
    });

    it("should allow owner to record a score", async function () {
      await expect(round.recordScore(0, E18(80)))
        .to.emit(round, "Evaluated")
        .withArgs(0, E18(80));

      const app = await round.getApplication(0);
      expect(app.score).to.equal(E18(80));
    });

    it("should allow authorized evaluator to record a score", async function () {
      await round.setEvaluator(evaluator.address, true);
      await expect(
        round.connect(evaluator).recordScore(0, E18(75))
      ).to.emit(round, "Evaluated");
    });

    it("should revert if non-evaluator records a score", async function () {
      await expect(
        round.connect(applicant1).recordScore(0, E18(80))
      ).to.be.revertedWithCustomError(round, "NotAuthorizedEvaluator");
    });

    it("should revert with score > 100e18", async function () {
      await expect(
        round.recordScore(0, E18(101))
      ).to.be.revertedWithCustomError(round, "InvalidScore");
    });

    it("should record batch scores", async function () {
      await expect(
        round.recordScores([0, 1], [E18(85), E18(72)])
      ).to.emit(round, "Evaluated");

      const app0 = await round.getApplication(0);
      const app1 = await round.getApplication(1);
      expect(app0.score).to.equal(E18(85));
      expect(app1.score).to.equal(E18(72));
    });

    it("should revert on mismatched batch lengths", async function () {
      await expect(
        round.recordScores([0, 1], [E18(85)])
      ).to.be.reverted;
    });
  });

  describe("setAllocation / distributeFunds", function () {
    beforeEach(async function () {
      await round.connect(applicant1).submitApplication(APP_URI_1);
      await round.connect(applicant2).submitApplication(APP_URI_2);
      await round.recordScores([0, 1], [E18(85), E18(72)]);
    });

    it("should allow owner to set allocation", async function () {
      await expect(round.setAllocation(0, ethers.parseEther("50")))
        .to.emit(round, "Allocated");

      const app = await round.getApplication(0);
      expect(app.allocation).to.equal(ethers.parseEther("50"));
    });

    it("should set batch allocations", async function () {
      await round.setAllocations(
        [0, 1],
        [ethers.parseEther("50"), ethers.parseEther("30")]
      );

      const app0 = await round.getApplication(0);
      const app1 = await round.getApplication(1);
      expect(app0.allocation).to.equal(ethers.parseEther("50"));
      expect(app1.allocation).to.equal(ethers.parseEther("30"));
    });

    it("should allow claiming in Funded status", async function () {
      // Fund the pool
      await owner.sendTransaction({
        to: await round.getAddress(),
        value: ethers.parseEther("100"),
      });

      // Set allocations
      await round.setAllocation(0, ethers.parseEther("50"));

      // Advance status: Accepting -> Evaluating -> Funded
      await round.startEvaluation();
      await round.markFunded();

      // Claim
      await expect(
        round.connect(applicant1).claimFunds(0)
      ).to.emit(round, "FundsClaimed");

      // Verify funded flag
      const app = await round.getApplication(0);
      expect(app.funded).to.be.true;
    });

    it("should revert claim if not in Funded status", async function () {
      await round.setAllocation(0, ethers.parseEther("50"));
      // Status is still Accepting
      await expect(
        round.connect(applicant1).claimFunds(0)
      ).to.be.revertedWithCustomError(round, "RoundNotAccepting");
    });

    it("should revert claim if not applicant", async function () {
      await round.setAllocation(0, ethers.parseEther("50"));
      await round.startEvaluation();
      await round.markFunded();

      await expect(
        round.connect(applicant2).claimFunds(0)
      ).to.be.revertedWithCustomError(round, "NotApplicant");
    });

    it("should revert claim if already funded", async function () {
      await owner.sendTransaction({
        to: await round.getAddress(),
        value: ethers.parseEther("100"),
      });
      await round.setAllocation(0, ethers.parseEther("50"));
      await round.startEvaluation();
      await round.markFunded();

      await round.connect(applicant1).claimFunds(0);
      await expect(
        round.connect(applicant1).claimFunds(0)
      ).to.be.revertedWithCustomError(round, "AlreadyFunded");
    });

    it("should revert claim if allocation is zero", async function () {
      // No allocation set
      await round.startEvaluation();
      await round.markFunded();

      await expect(
        round.connect(applicant1).claimFunds(0)
      ).to.be.revertedWithCustomError(round, "NothingToClaim");
    });
  });

  describe("Status management", function () {
    it("should advance Accepting -> Evaluating", async function () {
      await expect(round.startEvaluation())
        .to.emit(round, "RoundStatusChanged");
      expect(await round.getStatus()).to.equal(1);
    });

    it("should advance Evaluating -> Funded", async function () {
      await round.startEvaluation();
      await expect(round.markFunded())
        .to.emit(round, "RoundStatusChanged");
      expect(await round.getStatus()).to.equal(2);
    });

    it("should advance any status -> Closed (owner)", async function () {
      await round.startEvaluation();
      await round.markFunded();
      await round.closeRound();
      expect(await round.getStatus()).to.equal(3);
    });

    it("should revert invalid transition: Accepting -> Funded", async function () {
      await expect(round.markFunded())
        .to.be.revertedWithCustomError(round, "InvalidTransition");
    });

    it("should reject applications after deadline (onlyAccepting check)", async function () {
      // The onlyAccepting modifier checks block.timestamp > applicationDeadline
      // We need to move time past the deadline
      const deadline = await round.applicationDeadline();
      await time.increaseTo(Number(deadline) + 1);

      await expect(
        round.connect(applicant1).submitApplication(APP_URI_1)
      ).to.be.revertedWithCustomError(round, "ApplicationDeadlinePassed");
    });
  });

  describe("Evaluator management", function () {
    it("should add evaluator", async function () {
      await expect(round.setEvaluator(evaluator.address, true))
        .to.emit(round, "EvaluatorUpdated")
        .withArgs(evaluator.address, true);

      expect(await round.authorizedEvaluators(evaluator.address)).to.be.true;
    });

    it("should remove evaluator", async function () {
      await round.setEvaluator(evaluator.address, true);
      await round.setEvaluator(evaluator.address, false);
      expect(await round.authorizedEvaluators(evaluator.address)).to.be.false;
    });

    it("should revert with zero address", async function () {
      await expect(
        round.setEvaluator(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(round, "ZeroAddress");
    });
  });

  describe("fundPool", function () {
    it("should accept ETH funding", async function () {
      await expect(
        owner.sendTransaction({
          to: await round.getAddress(),
          value: ethers.parseEther("10"),
        })
      ).to.changeEtherBalances(
        [owner, round],
        [ethers.parseEther("-10"), ethers.parseEther("10")]
      );
    });

    it("should track matchingPool via fundPool()", async function () {
      await round.fundPool({ value: ethers.parseEther("5") });
      expect(await round.matchingPool()).to.equal(ethers.parseEther("5"));
    });
  });

  describe("getAllApplicationIds", function () {
    it("should return all application IDs", async function () {
      await round.connect(applicant1).submitApplication(APP_URI_1);
      await round.connect(applicant2).submitApplication(APP_URI_2);

      const ids = await round.getAllApplicationIds();
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(0);
      expect(ids[1]).to.equal(1);
    });
  });
});
