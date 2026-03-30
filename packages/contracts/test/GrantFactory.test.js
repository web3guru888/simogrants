const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("GrantFactory", function () {
  let factory, implementation, owner, user1;
  const METADATA_URI = "ipfs://QmTestRoundMetadata";
  const MATCHING_POOL = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy GrantRound implementation
    const GrantRound = await ethers.getContractFactory("GrantRound");
    implementation = await GrantRound.deploy();

    // Deploy GrantFactory with the implementation
    const GrantFactory = await ethers.getContractFactory("GrantFactory");
    factory = await GrantFactory.deploy(await implementation.getAddress());
  });

  describe("Deployment", function () {
    it("should set the implementation address", async function () {
      expect(await factory.implementation()).to.equal(await implementation.getAddress());
    });

    it("should set the deployer as owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("should revert with zero address implementation", async function () {
      const GrantFactory = await ethers.getContractFactory("GrantFactory");
      await expect(GrantFactory.deploy(ethers.ZeroAddress)).to.be.reverted;
    });

    it("should start with zero rounds", async function () {
      expect(await factory.roundCount()).to.equal(0);
    });
  });

  describe("createRound", function () {
    const TOKEN = ethers.ZeroAddress; // native ETH
    let futureDeadline;

    beforeEach(async function () {
      // Set deadline 7 days in the future
      futureDeadline = (await time.latest()) + 7 * 24 * 60 * 60;
    });

    it("should create a new round via minimal proxy", async function () {
      const tx = await factory.createRound(
        METADATA_URI, MATCHING_POOL, TOKEN, futureDeadline, futureDeadline
      );
      const receipt = await tx.wait();

      // Find RoundCreated event
      const event = receipt.logs
        .map(log => {
          try { return factory.interface.parseLog(log); } catch { return null; }
        })
        .find(e => e?.name === "RoundCreated");

      expect(event).to.not.be.null;
      expect(await factory.roundCount()).to.equal(1);
    });

    it("should track the created round in isRound mapping", async function () {
      const tx = await factory.createRound(
        METADATA_URI, MATCHING_POOL, TOKEN, futureDeadline, futureDeadline
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map(log => {
          try { return factory.interface.parseLog(log); } catch { return null; }
        })
        .find(e => e?.name === "RoundCreated");
      const roundAddr = event.args.roundAddress;

      expect(await factory.isRound(roundAddr)).to.be.true;
    });

    it("should emit RoundCreated with correct parameters", async function () {
      const tx = await factory.createRound(
        METADATA_URI, MATCHING_POOL, TOKEN, futureDeadline, futureDeadline
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map(log => {
          try { return factory.interface.parseLog(log); } catch { return null; }
        })
        .find(e => e?.name === "RoundCreated");

      expect(event.args.creator).to.equal(owner.address);
      expect(event.args.matchingPool).to.equal(MATCHING_POOL);
      expect(event.args.token).to.equal(TOKEN);
      expect(event.args.applicationDeadline).to.equal(futureDeadline);
    });

    it("should allow anyone to create a round", async function () {
      await expect(
        factory.connect(user1).createRound(
          METADATA_URI, MATCHING_POOL, TOKEN, futureDeadline, futureDeadline
        )
      ).to.not.be.reverted;
    });

    it("should revert with past deadline", async function () {
      const pastDeadline = (await time.latest()) - 1;
      await expect(
        factory.createRound(
          METADATA_URI, MATCHING_POOL, TOKEN, pastDeadline, pastDeadline
        )
      ).to.be.revertedWithCustomError(factory, "InvalidDeadline");
    });

    it("should initialize the cloned round correctly", async function () {
      const tx = await factory.createRound(
        METADATA_URI, MATCHING_POOL, TOKEN, futureDeadline, futureDeadline
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map(log => {
          try { return factory.interface.parseLog(log); } catch { return null; }
        })
        .find(e => e?.name === "RoundCreated");
      const roundAddr = event.args.roundAddress;

      const round = await ethers.getContractAt("GrantRound", roundAddr);
      expect(await round.metadataURI()).to.equal(METADATA_URI);
      expect(await round.applicationDeadline()).to.equal(futureDeadline);
      expect(await round.token()).to.equal(TOKEN);
      expect(await round.factory()).to.equal(await factory.getAddress());
      expect(await round.owner()).to.equal(owner.address);
    });
  });

  describe("roundCount / getRound / getAllRounds", function () {
    const TOKEN = ethers.ZeroAddress;

    beforeEach(async function () {
      const deadline = (await time.latest()) + 7 * 24 * 60 * 60;
      // Create 3 rounds
      for (let i = 0; i < 3; i++) {
        await factory.createRound(
          METADATA_URI + i, MATCHING_POOL, TOKEN, deadline, deadline
        );
      }
    });

    it("should return correct round count", async function () {
      expect(await factory.roundCount()).to.equal(3);
    });

    it("should return correct round address by index", async function () {
      const round0 = await factory.getRound(0);
      const round1 = await factory.getRound(1);
      expect(round0).to.not.equal(round1);
      expect(round0).to.properAddress;
    });

    it("should revert for invalid index", async function () {
      await expect(factory.getRound(3)).to.be.reverted;
    });

    it("should return all rounds", async function () {
      const allRounds = await factory.getAllRounds();
      expect(allRounds.length).to.equal(3);
    });
  });

  describe("setImplementation", function () {
    it("should update implementation (owner only)", async function () {
      const GrantRound = await ethers.getContractFactory("GrantRound");
      const newImpl = await GrantRound.deploy();

      await expect(factory.setImplementation(await newImpl.getAddress()))
        .to.emit(factory, "ImplementationUpdated");

      expect(await factory.implementation()).to.equal(await newImpl.getAddress());
    });

    it("should revert if non-owner calls setImplementation", async function () {
      await expect(
        factory.connect(user1).setImplementation(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should revert with zero address", async function () {
      await expect(
        factory.setImplementation(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });
  });
});
