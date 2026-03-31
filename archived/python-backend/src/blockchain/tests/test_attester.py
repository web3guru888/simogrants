"""
Tests for AttestationPublisher — hashing functions, result dataclasses,
and mocked publish flow.
"""

from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from attester import (
    AttestationPublisher,
    AttestationResult,
    BatchAttestationResult,
    compute_evaluation_hash,
    compute_project_hash,
    _keccak256,
)


# ── Keccak256 Tests ──────────────────────────────────────────────────

class TestKeccak256:
    """Verify keccak256 implementation produces correct digests."""

    def test_empty_string(self):
        """keccak256("") is a well-known constant."""
        digest = _keccak256(b"")
        expected = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        assert digest.hex() == expected

    def test_hello(self):
        """keccak256("hello") check."""
        digest = _keccak256(b"hello")
        # Known keccak256 of "hello"
        expected = "1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8"
        assert digest.hex() == expected

    def test_deterministic(self):
        d1 = _keccak256(b"test data")
        d2 = _keccak256(b"test data")
        assert d1 == d2

    def test_different_input_different_output(self):
        d1 = _keccak256(b"input_a")
        d2 = _keccak256(b"input_b")
        assert d1 != d2

    def test_output_length(self):
        digest = _keccak256(b"anything")
        assert len(digest) == 32  # 256 bits


# ── Hash Function Tests ──────────────────────────────────────────────

class TestComputeHashes:
    """Test the public hash functions used by the publisher."""

    def test_evaluation_hash_deterministic(self):
        ev = {"score": 85, "confidence": 0.92}
        h1 = compute_evaluation_hash(ev)
        h2 = compute_evaluation_hash(ev)
        assert h1 == h2
        assert len(h1) == 32

    def test_evaluation_hash_key_order_invariant(self):
        """sort_keys=True in JSON serialization makes order irrelevant."""
        h1 = compute_evaluation_hash({"b": 2, "a": 1})
        h2 = compute_evaluation_hash({"a": 1, "b": 2})
        assert h1 == h2

    def test_evaluation_hash_different_data(self):
        h1 = compute_evaluation_hash({"score": 85})
        h2 = compute_evaluation_hash({"score": 86})
        assert h1 != h2

    def test_project_hash_deterministic(self):
        h1 = compute_project_hash("gitcoin-gg20")
        h2 = compute_project_hash("gitcoin-gg20")
        assert h1 == h2
        assert len(h1) == 32

    def test_project_hash_different_ids(self):
        h1 = compute_project_hash("project-1")
        h2 = compute_project_hash("project-2")
        assert h1 != h2

    def test_project_hash_matches_solidity_convention(self):
        """The hash should match keccak256(abi.encodePacked(string))."""
        pid = "test-project"
        h = compute_project_hash(pid)
        # This is keccak256 of raw UTF-8 bytes — matches Solidity's
        # keccak256(bytes("test-project"))
        expected = _keccak256(pid.encode("utf-8"))
        assert h == expected


# ── Result Dataclasses ───────────────────────────────────────────────

class TestAttestationResult:
    def test_frozen(self):
        r = AttestationResult(
            tx_hash="0xabc",
            block_number=100,
            cid="bafytest",
            project_hash="0x111",
            evaluation_hash="0x222",
            gas_used=50000,
            epoch=0,
            index=0,
        )
        with pytest.raises(AttributeError):
            r.tx_hash = "0xnew"  # type: ignore

    def test_fields(self):
        r = AttestationResult(
            tx_hash="0xabc",
            block_number=100,
            cid="bafytest",
            project_hash="0x111",
            evaluation_hash="0x222",
            gas_used=50000,
            epoch=1,
            index=3,
        )
        assert r.tx_hash == "0xabc"
        assert r.block_number == 100
        assert r.cid == "bafytest"
        assert r.epoch == 1
        assert r.index == 3


class TestBatchAttestationResult:
    def test_fields(self):
        r = BatchAttestationResult(
            tx_hash="0xbatch",
            block_number=200,
            cids=["cid1", "cid2"],
            project_hashes=["0xa", "0xb"],
            evaluation_hashes=["0xc", "0xd"],
            gas_used=120000,
            count=2,
        )
        assert r.count == 2
        assert len(r.cids) == 2


# ── Publisher Init ───────────────────────────────────────────────────

class TestPublisherInit:
    def test_default_rpc(self):
        p = AttestationPublisher()
        assert "base.org" in p.rpc_url

    def test_env_overrides(self, monkeypatch):
        monkeypatch.setenv("BASE_RPC_URL", "https://custom-rpc.io")
        monkeypatch.setenv("ATTESTATION_CONTRACT", "0xContractAddr")
        monkeypatch.setenv("ATTESTER_PRIVATE_KEY", "0xdeadbeef")

        p = AttestationPublisher()
        assert p.rpc_url == "https://custom-rpc.io"
        assert p.contract_address == "0xContractAddr"
        assert p._private_key == "0xdeadbeef"

    def test_repr(self):
        p = AttestationPublisher(
            rpc_url="https://rpc.test",
            contract_address="0x123",
            chain_id=84532,
        )
        r = repr(p)
        assert "rpc.test" in r
        assert "0x123" in r
        assert "84532" in r


# ── Mocked Publish Flow ─────────────────────────────────────────────

class TestPublishFlow:
    """Test the publish method with fully mocked Web3 and Filecoin."""

    @pytest.mark.asyncio
    async def test_publish_end_to_end_mock(self):
        """Verify the orchestration: hash → upload → tx → result."""
        publisher = AttestationPublisher(
            rpc_url="http://localhost:8545",
            contract_address="0x" + "11" * 20,
            private_key="0x" + "ab" * 32,
            filecoin_token="test-token",
            chain_id=31337,
        )

        # Mock the filecoin uploader
        publisher.uploader.upload_json = AsyncMock(return_value="bafyMockCID123")

        # Mock web3 internals
        mock_w3 = MagicMock()
        mock_w3.eth.chain_id = 31337
        mock_w3.eth.get_transaction_count.return_value = 0
        mock_w3.eth.send_raw_transaction.return_value = b"\x00" * 32
        mock_w3.eth.wait_for_transaction_receipt.return_value = {
            "transactionHash": b"\xaa" * 32,
            "blockNumber": 42,
            "gasUsed": 65000,
        }

        mock_account = MagicMock()
        mock_account.address = "0x" + "FF" * 20
        mock_account.sign_transaction.return_value = MagicMock(
            raw_transaction=b"\x00" * 100
        )

        mock_contract = MagicMock()
        mock_contract.functions.publishAttestation.return_value.build_transaction.return_value = {
            "from": mock_account.address,
            "nonce": 0,
            "chainId": 31337,
            "gas": 100000,
        }
        mock_contract.functions.getAttestationCount.return_value.call.return_value = 1
        mock_contract.functions.currentEpoch.return_value.call.return_value = 0

        publisher._w3 = mock_w3
        publisher._account = mock_account
        publisher._contract = mock_contract

        result = await publisher.publish(
            project_id="test-project",
            evidence={"score": 99},
        )

        assert isinstance(result, AttestationResult)
        assert result.cid == "bafyMockCID123"
        assert result.block_number == 42
        assert result.gas_used == 65000
        assert result.index == 0
        assert result.epoch == 0

        # Verify uploader was called
        publisher.uploader.upload_json.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_close(self):
        publisher = AttestationPublisher(filecoin_token="tok")
        publisher.uploader.close = AsyncMock()
        await publisher.close()
        publisher.uploader.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_context_manager(self):
        async with AttestationPublisher(filecoin_token="tok") as pub:
            assert pub is not None


# ── Read Helpers ─────────────────────────────────────────────────────

class TestReadHelpers:
    @pytest.mark.asyncio
    async def test_get_attestation_count_mock(self):
        publisher = AttestationPublisher(
            rpc_url="http://localhost:8545",
            contract_address="0x" + "11" * 20,
            private_key="0x" + "ab" * 32,
        )

        mock_contract = MagicMock()
        mock_contract.functions.getAttestationCount.return_value.call.return_value = 5
        publisher._w3 = MagicMock()
        publisher._contract = mock_contract
        publisher._account = MagicMock()

        count = await publisher.get_attestation_count("some-project")
        assert count == 5

    @pytest.mark.asyncio
    async def test_get_current_epoch_mock(self):
        publisher = AttestationPublisher(
            rpc_url="http://localhost:8545",
            contract_address="0x" + "11" * 20,
            private_key="0x" + "ab" * 32,
        )

        mock_contract = MagicMock()
        mock_contract.functions.currentEpoch.return_value.call.return_value = 3
        publisher._w3 = MagicMock()
        publisher._contract = mock_contract
        publisher._account = MagicMock()

        epoch = await publisher.get_current_epoch()
        assert epoch == 3
