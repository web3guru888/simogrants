const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AttestationRegistry", function () {
  let registry, owner, attester, user;
  const PROJECT_HASH = ethers.keccak256(ethers.toUtf8Bytes("project-alpha"));
  const EVAL_HASH = ethers.keccak256(ethers.toUtf8Bytes("eval-1"));
  const IPFS_URI = "ipfs://QmTestCID123";
  const R2_URI = "https://pub-abc.r2.dev/eval.json";

  beforeEach(async function () {
    [owner, attester, user] = await ethers.getSigners();

    const AttestationRegistry = await ethers.getContractFactory("AttestationRegistry");
    registry = await AttestationRegistry.deploy();
  });

  describe("Deployment", function () {
    it("should set deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should authorize deployer as attester", async function () {
      expect(await registry.authorizedAttesters(owner.address)).to.be.true;
    });

    it("should start at epoch 0", async function () {
      expect(await registry.currentEpoch()).to.equal(0);
    });
  });

  describe("publishAttestation (single)", function () {
    it("should publish an attestation", async function () {
      await expect(
        registry.publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI)
      ).to.emit(registry, "AttestationPublished");

      expect(await registry.totalAttestations()).to.equal(1);
    });

    it("should auto-detect IPFS source", async function () {
      await registry.publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI);
      const att = await registry.getLatestAttestation(PROJECT_HASH);
      expect(att.source).to.equal(0); // SOURCE_IPFS
    });

    it("should auto-detect R2 source", async function () {
      await registry.publishAttestation(PROJECT_HASH, EVAL_HASH, R2_URI);
      const att = await registry.getLatestAttestation(PROJECT_HASH);
      expect(att.source).to.equal(1); // SOURCE_R2
    });

    it("should store attestation data correctly", async function () {
      await registry.publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI);
      const att = await registry.getLatestAttestation(PROJECT_HASH);

      expect(att.evaluationHash).to.equal(EVAL_HASH);
      expect(att.evidenceURI).to.equal(IPFS_URI);
      expect(att.attester).to.equal(owner.address);
      expect(att.epoch).to.equal(0);
      expect(att.timestamp).to.be.gt(0);
    });

    it("should allow explicit source parameter", async function () {
      const fn = registry.getFunction("publishAttestation(bytes32,bytes32,string,uint8)");
      await fn(
        PROJECT_HASH, EVAL_HASH, R2_URI, 1 // SOURCE_R2
      );
      const att = await registry.getLatestAttestation(PROJECT_HASH);
      expect(att.source).to.equal(1);
    });

    it("should revert with zero project hash", async function () {
      await expect(
        registry.publishAttestation(ethers.ZeroHash, EVAL_HASH, IPFS_URI)
      ).to.be.revertedWithCustomError(registry, "ZeroProjectHash");
    });

    it("should revert with zero evaluation hash", async function () {
      await expect(
        registry.publishAttestation(PROJECT_HASH, ethers.ZeroHash, IPFS_URI)
      ).to.be.revertedWithCustomError(registry, "ZeroEvaluationHash");
    });

    it("should revert with empty URI", async function () {
      await expect(
        registry.publishAttestation(PROJECT_HASH, EVAL_HASH, "")
      ).to.be.revertedWithCustomError(registry, "EmptyURI");
    });

    it("should revert if not authorized", async function () {
      await expect(
        registry.connect(user).publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI)
      ).to.be.revertedWithCustomError(registry, "NotAuthorized");
    });

    it("should track multiple attestations per project", async function () {
      const EVAL2 = ethers.keccak256(ethers.toUtf8Bytes("eval-2"));
      await registry.publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI);
      await registry.publishAttestation(PROJECT_HASH, EVAL2, R2_URI);

      expect(await registry.getAttestationCount(PROJECT_HASH)).to.equal(2);
    });
  });

  describe("publishBatch", function () {
    it("should publish multiple attestations in one tx", async function () {
      const project2 = ethers.keccak256(ethers.toUtf8Bytes("project-beta"));
      const eval2 = ethers.keccak256(ethers.toUtf8Bytes("eval-2"));

      await expect(
        registry.publishBatch(
          [PROJECT_HASH, project2],
          [EVAL_HASH, eval2],
          [IPFS_URI, R2_URI]
        )
      ).to.emit(registry, "AttestationPublished");

      expect(await registry.totalAttestations()).to.equal(2);
    });

    it("should revert with mismatched batch lengths", async function () {
      await expect(
        registry.publishBatch(
          [PROJECT_HASH],
          [EVAL_HASH, ethers.ZeroHash],
          [IPFS_URI]
        )
      ).to.be.revertedWithCustomError(registry, "BatchLengthMismatch");
    });

    it("should publish batch with explicit sources", async function () {
      const fn = registry.getFunction("publishBatch(bytes32[],bytes32[],string[],uint8[])");
      await fn(
        [PROJECT_HASH],
        [EVAL_HASH],
        [R2_URI],
        [1] // SOURCE_R2
      );

      const att = await registry.getLatestAttestation(PROJECT_HASH);
      expect(att.source).to.equal(1);
    });
  });

  describe("View functions", function () {
    it("should return latest attestation", async function () {
      const eval2 = ethers.keccak256(ethers.toUtf8Bytes("eval-2"));
      await registry.publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI);
      await registry.publishAttestation(PROJECT_HASH, eval2, R2_URI);

      const att = await registry.getLatestAttestation(PROJECT_HASH);
      expect(att.evaluationHash).to.equal(eval2);
    });

    it("should return attestation by index", async function () {
      await registry.publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI);
      const att = await registry.getAttestation(PROJECT_HASH, 0);
      expect(att.evaluationHash).to.equal(EVAL_HASH);
    });

    it("should return all attestations for a project", async function () {
      const eval2 = ethers.keccak256(ethers.toUtf8Bytes("eval-2"));
      await registry.publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI);
      await registry.publishAttestation(PROJECT_HASH, eval2, R2_URI);

      const all = await registry.getAllAttestations(PROJECT_HASH);
      expect(all.length).to.equal(2);
    });

    it("should return 0 for unknown project", async function () {
      expect(await registry.getAttestationCount(PROJECT_HASH)).to.equal(0);
    });
  });

  describe("Epoch management", function () {
    it("should advance epoch", async function () {
      await expect(registry.advanceEpoch())
        .to.emit(registry, "EpochAdvanced")
        .withArgs(0, 1);
    });

    it("should revert if non-owner advances epoch", async function () {
      await expect(
        registry.connect(user).advanceEpoch()
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");
    });
  });

  describe("Attester management", function () {
    it("should add attester", async function () {
      await expect(registry.setAttester(attester.address, true))
        .to.emit(registry, "AttesterUpdated");

      expect(await registry.authorizedAttesters(attester.address)).to.be.true;
    });

    it("should allow new attester to publish", async function () {
      await registry.setAttester(attester.address, true);
      await expect(
        registry.connect(attester).publishAttestation(PROJECT_HASH, EVAL_HASH, IPFS_URI)
      ).to.not.be.reverted;
    });

    it("should remove attester", async function () {
      await registry.setAttester(attester.address, true);
      await registry.setAttester(attester.address, false);
      expect(await registry.authorizedAttesters(attester.address)).to.be.false;
    });

    it("should revert with zero address", async function () {
      await expect(
        registry.setAttester(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("should revert if non-owner sets attester", async function () {
      await expect(
        registry.connect(user).setAttester(attester.address, true)
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");
    });
  });

  describe("Ownership", function () {
    it("should transfer ownership", async function () {
      await expect(registry.transferOwnership(attester.address))
        .to.emit(registry, "OwnershipTransferred")
        .withArgs(owner.address, attester.address);
    });

    it("should revert transfer to zero address", async function () {
      await expect(
        registry.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });
});
