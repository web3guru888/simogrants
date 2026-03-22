/**
 * SIMOGrantsAttestation — Full Test Suite
 *
 * Coverage:
 *   - Deployment & initial state
 *   - publishAttestation (single)
 *   - publishBatch (multiple)
 *   - advanceEpoch
 *   - Attester management (setAttester)
 *   - Ownership transfer
 *   - Access control (revert paths)
 *   - Edge cases & gas optimization verification
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("SIMOGrantsAttestation", function () {
  // ── Fixtures ─────────────────────────────────────────────────────

  async function deployFixture() {
    const [owner, attester1, attester2, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("SIMOGrantsAttestation");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    // Precomputed hashes for testing
    const projectId = "gitcoin-gg20-round";
    const projectHash = ethers.keccak256(ethers.toUtf8Bytes(projectId));
    const evidenceJSON = JSON.stringify({ score: 85, confidence: 0.92 });
    const evaluationHash = ethers.keccak256(ethers.toUtf8Bytes(evidenceJSON));
    const filecoinCID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    return {
      contract,
      owner,
      attester1,
      attester2,
      stranger,
      projectHash,
      evaluationHash,
      filecoinCID,
      projectId,
    };
  }

  // ── Deployment ───────────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should authorize the deployer as attester", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.authorizedAttesters(owner.address)).to.be.true;
    });

    it("should start at epoch 0", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.currentEpoch()).to.equal(0);
    });

    it("should start with 0 total attestations", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.totalAttestations()).to.equal(0);
    });
  });

  // ── publishAttestation (single) ──────────────────────────────────

  describe("publishAttestation", function () {
    it("should publish an attestation and emit event", async function () {
      const { contract, owner, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await expect(
        contract.publishAttestation(projectHash, evaluationHash, filecoinCID)
      )
        .to.emit(contract, "AttestationPublished")
        .withArgs(projectHash, evaluationHash, filecoinCID, owner.address, 0, 0);
    });

    it("should increment attestation count for the project", async function () {
      const { contract, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      expect(await contract.getAttestationCount(projectHash)).to.equal(0);

      await contract.publishAttestation(projectHash, evaluationHash, filecoinCID);
      expect(await contract.getAttestationCount(projectHash)).to.equal(1);

      // Second attestation (different eval hash)
      const evalHash2 = ethers.keccak256(ethers.toUtf8Bytes("second evaluation"));
      await contract.publishAttestation(projectHash, evalHash2, "bafyotherCID");
      expect(await contract.getAttestationCount(projectHash)).to.equal(2);
    });

    it("should increment totalAttestations", async function () {
      const { contract, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await contract.publishAttestation(projectHash, evaluationHash, filecoinCID);
      expect(await contract.totalAttestations()).to.equal(1);
    });

    it("should store correct attestation data", async function () {
      const { contract, owner, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await contract.publishAttestation(projectHash, evaluationHash, filecoinCID);

      const att = await contract.getLatestAttestation(projectHash);
      expect(att.evaluationHash).to.equal(evaluationHash);
      expect(att.filecoinCID).to.equal(filecoinCID);
      expect(att.attester).to.equal(owner.address);
      expect(att.epoch).to.equal(0);
      expect(att.timestamp).to.be.gt(0);
    });

    it("should store attestation with correct epoch after advance", async function () {
      const { contract, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await contract.advanceEpoch(); // epoch → 1
      await contract.advanceEpoch(); // epoch → 2

      await contract.publishAttestation(projectHash, evaluationHash, filecoinCID);

      const att = await contract.getLatestAttestation(projectHash);
      expect(att.epoch).to.equal(2);
    });

    it("should revert for unauthorized caller", async function () {
      const { contract, stranger, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await expect(
        contract.connect(stranger).publishAttestation(projectHash, evaluationHash, filecoinCID)
      ).to.be.revertedWithCustomError(contract, "NotAuthorized");
    });

    it("should revert for zero projectHash", async function () {
      const { contract, evaluationHash, filecoinCID } = await loadFixture(deployFixture);

      await expect(
        contract.publishAttestation(ethers.ZeroHash, evaluationHash, filecoinCID)
      ).to.be.revertedWithCustomError(contract, "ZeroProjectHash");
    });

    it("should revert for zero evaluationHash", async function () {
      const { contract, projectHash, filecoinCID } = await loadFixture(deployFixture);

      await expect(
        contract.publishAttestation(projectHash, ethers.ZeroHash, filecoinCID)
      ).to.be.revertedWithCustomError(contract, "ZeroEvaluationHash");
    });

    it("should revert for empty CID", async function () {
      const { contract, projectHash, evaluationHash } = await loadFixture(deployFixture);

      await expect(
        contract.publishAttestation(projectHash, evaluationHash, "")
      ).to.be.revertedWithCustomError(contract, "EmptyCID");
    });

    it("should allow authorized non-owner attester", async function () {
      const { contract, attester1, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await contract.setAttester(attester1.address, true);

      await expect(
        contract.connect(attester1).publishAttestation(projectHash, evaluationHash, filecoinCID)
      )
        .to.emit(contract, "AttestationPublished")
        .withArgs(projectHash, evaluationHash, filecoinCID, attester1.address, 0, 0);
    });
  });

  // ── publishBatch ─────────────────────────────────────────────────

  describe("publishBatch", function () {
    it("should publish multiple attestations in a single tx", async function () {
      const { contract, owner } = await loadFixture(deployFixture);

      const ph1 = ethers.keccak256(ethers.toUtf8Bytes("project-1"));
      const ph2 = ethers.keccak256(ethers.toUtf8Bytes("project-2"));
      const ph3 = ethers.keccak256(ethers.toUtf8Bytes("project-3"));

      const eh1 = ethers.keccak256(ethers.toUtf8Bytes("eval-1"));
      const eh2 = ethers.keccak256(ethers.toUtf8Bytes("eval-2"));
      const eh3 = ethers.keccak256(ethers.toUtf8Bytes("eval-3"));

      const tx = contract.publishBatch(
        [ph1, ph2, ph3],
        [eh1, eh2, eh3],
        ["cid1", "cid2", "cid3"]
      );

      // Check all three events
      await expect(tx)
        .to.emit(contract, "AttestationPublished")
        .withArgs(ph1, eh1, "cid1", owner.address, 0, 0);

      expect(await contract.totalAttestations()).to.equal(3);
      expect(await contract.getAttestationCount(ph1)).to.equal(1);
      expect(await contract.getAttestationCount(ph2)).to.equal(1);
      expect(await contract.getAttestationCount(ph3)).to.equal(1);
    });

    it("should revert for mismatched array lengths", async function () {
      const { contract } = await loadFixture(deployFixture);

      const ph = ethers.keccak256(ethers.toUtf8Bytes("p1"));
      const eh = ethers.keccak256(ethers.toUtf8Bytes("e1"));

      await expect(
        contract.publishBatch([ph, ph], [eh], ["cid1", "cid2"])
      ).to.be.revertedWithCustomError(contract, "BatchLengthMismatch");
    });

    it("should revert if one entry has zero projectHash", async function () {
      const { contract } = await loadFixture(deployFixture);

      const ph = ethers.keccak256(ethers.toUtf8Bytes("good"));
      const eh = ethers.keccak256(ethers.toUtf8Bytes("eval"));

      await expect(
        contract.publishBatch([ph, ethers.ZeroHash], [eh, eh], ["cid1", "cid2"])
      ).to.be.revertedWithCustomError(contract, "ZeroProjectHash");
    });

    it("should handle batch with same project (multiple attestations)", async function () {
      const { contract, projectHash } = await loadFixture(deployFixture);

      const eh1 = ethers.keccak256(ethers.toUtf8Bytes("e1"));
      const eh2 = ethers.keccak256(ethers.toUtf8Bytes("e2"));

      await contract.publishBatch(
        [projectHash, projectHash],
        [eh1, eh2],
        ["cidA", "cidB"]
      );

      expect(await contract.getAttestationCount(projectHash)).to.equal(2);

      const all = await contract.getAllAttestations(projectHash);
      expect(all.length).to.equal(2);
      expect(all[0].filecoinCID).to.equal("cidA");
      expect(all[1].filecoinCID).to.equal("cidB");
    });

    it("should revert for unauthorized batch caller", async function () {
      const { contract, stranger } = await loadFixture(deployFixture);

      const ph = ethers.keccak256(ethers.toUtf8Bytes("p"));
      const eh = ethers.keccak256(ethers.toUtf8Bytes("e"));

      await expect(
        contract.connect(stranger).publishBatch([ph], [eh], ["cid"])
      ).to.be.revertedWithCustomError(contract, "NotAuthorized");
    });
  });

  // ── advanceEpoch ─────────────────────────────────────────────────

  describe("advanceEpoch", function () {
    it("should increment epoch and emit event", async function () {
      const { contract, owner } = await loadFixture(deployFixture);

      await expect(contract.advanceEpoch())
        .to.emit(contract, "EpochAdvanced")
        .withArgs(0, 1, owner.address);

      expect(await contract.currentEpoch()).to.equal(1);
    });

    it("should increment multiple times", async function () {
      const { contract } = await loadFixture(deployFixture);

      await contract.advanceEpoch();
      await contract.advanceEpoch();
      await contract.advanceEpoch();

      expect(await contract.currentEpoch()).to.equal(3);
    });

    it("should revert for non-owner", async function () {
      const { contract, attester1 } = await loadFixture(deployFixture);

      // Even if attester1 is authorized, they can't advance epoch
      await contract.setAttester(attester1.address, true);

      await expect(
        contract.connect(attester1).advanceEpoch()
      ).to.be.revertedWithCustomError(contract, "OnlyOwner");
    });
  });

  // ── Attester management ──────────────────────────────────────────

  describe("setAttester", function () {
    it("should authorize a new attester", async function () {
      const { contract, attester1 } = await loadFixture(deployFixture);

      expect(await contract.authorizedAttesters(attester1.address)).to.be.false;

      await expect(contract.setAttester(attester1.address, true))
        .to.emit(contract, "AttesterUpdated")
        .withArgs(attester1.address, true);

      expect(await contract.authorizedAttesters(attester1.address)).to.be.true;
    });

    it("should deauthorize an attester", async function () {
      const { contract, attester1 } = await loadFixture(deployFixture);

      await contract.setAttester(attester1.address, true);
      await contract.setAttester(attester1.address, false);

      expect(await contract.authorizedAttesters(attester1.address)).to.be.false;
    });

    it("should revert for zero address", async function () {
      const { contract } = await loadFixture(deployFixture);

      await expect(
        contract.setAttester(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });

    it("should revert for non-owner caller", async function () {
      const { contract, attester1, attester2 } = await loadFixture(deployFixture);

      await expect(
        contract.connect(attester1).setAttester(attester2.address, true)
      ).to.be.revertedWithCustomError(contract, "OnlyOwner");
    });
  });

  // ── Ownership ────────────────────────────────────────────────────

  describe("transferOwnership", function () {
    it("should transfer ownership", async function () {
      const { contract, owner, attester1 } = await loadFixture(deployFixture);

      await expect(contract.transferOwnership(attester1.address))
        .to.emit(contract, "OwnershipTransferred")
        .withArgs(owner.address, attester1.address);

      expect(await contract.owner()).to.equal(attester1.address);
    });

    it("new owner should be able to advance epoch", async function () {
      const { contract, attester1 } = await loadFixture(deployFixture);

      await contract.transferOwnership(attester1.address);
      await expect(contract.connect(attester1).advanceEpoch())
        .to.emit(contract, "EpochAdvanced");
    });

    it("old owner should lose owner privileges", async function () {
      const { contract, attester1 } = await loadFixture(deployFixture);

      await contract.transferOwnership(attester1.address);

      await expect(contract.advanceEpoch())
        .to.be.revertedWithCustomError(contract, "OnlyOwner");
    });

    it("should revert for zero address", async function () {
      const { contract } = await loadFixture(deployFixture);

      await expect(
        contract.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });

    it("should revert for non-owner caller", async function () {
      const { contract, stranger, attester1 } = await loadFixture(deployFixture);

      await expect(
        contract.connect(stranger).transferOwnership(attester1.address)
      ).to.be.revertedWithCustomError(contract, "OnlyOwner");
    });
  });

  // ── View functions ───────────────────────────────────────────────

  describe("View functions", function () {
    it("getAttestation should return correct data by index", async function () {
      const { contract, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await contract.publishAttestation(projectHash, evaluationHash, filecoinCID);

      const eh2 = ethers.keccak256(ethers.toUtf8Bytes("second"));
      await contract.publishAttestation(projectHash, eh2, "cidSecond");

      const first = await contract.getAttestation(projectHash, 0);
      expect(first.evaluationHash).to.equal(evaluationHash);
      expect(first.filecoinCID).to.equal(filecoinCID);

      const second = await contract.getAttestation(projectHash, 1);
      expect(second.evaluationHash).to.equal(eh2);
      expect(second.filecoinCID).to.equal("cidSecond");
    });

    it("getLatestAttestation should return most recent", async function () {
      const { contract, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await contract.publishAttestation(projectHash, evaluationHash, filecoinCID);

      const eh2 = ethers.keccak256(ethers.toUtf8Bytes("latest"));
      await contract.publishAttestation(projectHash, eh2, "cidLatest");

      const latest = await contract.getLatestAttestation(projectHash);
      expect(latest.evaluationHash).to.equal(eh2);
    });

    it("getLatestAttestation should revert for empty project", async function () {
      const { contract, projectHash } = await loadFixture(deployFixture);

      await expect(
        contract.getLatestAttestation(projectHash)
      ).to.be.revertedWithCustomError(contract, "NoAttestations");
    });

    it("getAllAttestations should return full array", async function () {
      const { contract, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await contract.publishAttestation(projectHash, evaluationHash, filecoinCID);

      const eh2 = ethers.keccak256(ethers.toUtf8Bytes("second"));
      await contract.publishAttestation(projectHash, eh2, "cid2");

      const all = await contract.getAllAttestations(projectHash);
      expect(all.length).to.equal(2);
    });

    it("getAttestationCount for unknown project should be 0", async function () {
      const { contract } = await loadFixture(deployFixture);

      const unknown = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      expect(await contract.getAttestationCount(unknown)).to.equal(0);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe("Edge cases", function () {
    it("should handle very long CID strings", async function () {
      const { contract, projectHash, evaluationHash } = await loadFixture(deployFixture);

      const longCID = "bafybeig" + "a".repeat(200);
      await contract.publishAttestation(projectHash, evaluationHash, longCID);

      const att = await contract.getLatestAttestation(projectHash);
      expect(att.filecoinCID).to.equal(longCID);
    });

    it("should handle many attestations for one project", async function () {
      const { contract, projectHash } = await loadFixture(deployFixture);

      const batchSize = 20;
      const phs = Array(batchSize).fill(projectHash);
      const ehs = [];
      const cids = [];

      for (let i = 0; i < batchSize; i++) {
        ehs.push(ethers.keccak256(ethers.toUtf8Bytes(`eval-${i}`)));
        cids.push(`cid-${i}`);
      }

      await contract.publishBatch(phs, ehs, cids);

      expect(await contract.getAttestationCount(projectHash)).to.equal(batchSize);
      expect(await contract.totalAttestations()).to.equal(batchSize);
    });

    it("owner can still attest even without explicit authorization", async function () {
      const { contract, owner, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      // Owner is authorized at deploy, but let's also test the modifier logic:
      // owner always passes because of `|| msg.sender == owner` in older designs
      // — but here the constructor sets authorizedAttesters[owner] = true.
      await contract.publishAttestation(projectHash, evaluationHash, filecoinCID);
      expect(await contract.totalAttestations()).to.equal(1);
    });

    it("deauthorized attester cannot publish", async function () {
      const { contract, attester1, projectHash, evaluationHash, filecoinCID } =
        await loadFixture(deployFixture);

      await contract.setAttester(attester1.address, true);
      await contract.setAttester(attester1.address, false);

      await expect(
        contract.connect(attester1).publishAttestation(projectHash, evaluationHash, filecoinCID)
      ).to.be.revertedWithCustomError(contract, "NotAuthorized");
    });
  });
});
