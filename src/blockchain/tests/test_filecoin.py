"""
Tests for FilecoinUploader — async upload logic with retry and backend support.

Uses httpx mock transport to avoid real network calls.
"""

from __future__ import annotations

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

import httpx

# Adjust import path as needed
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from filecoin import FilecoinUploader, FilecoinUploadError, Backend


# ── Helpers ──────────────────────────────────────────────────────────

def _mock_response(status_code: int, **kwargs) -> httpx.Response:
    """Create an httpx.Response with a dummy request attached (required by raise_for_status)."""
    resp = httpx.Response(status_code, **kwargs)
    resp.request = httpx.Request("POST", "https://mock.test/upload")
    return resp


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def sample_evidence() -> dict:
    return {
        "project_id": "gitcoin-gg20-round",
        "scores": {"impact": 85, "feasibility": 90, "team": 78},
        "confidence": 0.92,
        "evaluator": "simogrants-agent-v1",
    }


@pytest.fixture
def web3_uploader() -> FilecoinUploader:
    return FilecoinUploader(
        api_token="test-token-web3storage",
        backend="web3storage",
        max_retries=2,
        retry_backoff=0.01,  # fast retries for tests
        timeout=5.0,
    )


@pytest.fixture
def lighthouse_uploader() -> FilecoinUploader:
    return FilecoinUploader(
        api_token="test-token-lighthouse",
        backend="lighthouse",
        max_retries=2,
        retry_backoff=0.01,
        timeout=5.0,
    )


# ── Unit Tests ───────────────────────────────────────────────────────

class TestFilecoinUploaderInit:
    """Constructor and configuration tests."""

    def test_default_backend(self):
        up = FilecoinUploader(api_token="tok")
        assert up.backend == Backend.WEB3STORAGE

    def test_lighthouse_backend(self):
        up = FilecoinUploader(api_token="tok", backend="lighthouse")
        assert up.backend == Backend.LIGHTHOUSE

    def test_invalid_backend_raises(self):
        with pytest.raises(ValueError):
            FilecoinUploader(api_token="tok", backend="badbackend")

    def test_token_from_env(self, monkeypatch):
        monkeypatch.setenv("WEB3STORAGE_TOKEN", "env-token-123")
        up = FilecoinUploader(backend="web3storage")
        assert up.api_token == "env-token-123"

    def test_lighthouse_token_from_env(self, monkeypatch):
        monkeypatch.setenv("LIGHTHOUSE_TOKEN", "lh-token-456")
        up = FilecoinUploader(backend="lighthouse")
        assert up.api_token == "lh-token-456"

    def test_repr_masks_token(self):
        up = FilecoinUploader(api_token="abcdefghijklmnop")
        r = repr(up)
        assert "abcdef…" in r
        assert "abcdefghijklmnop" not in r


class TestComputeLocalHash:
    """Deterministic hashing tests."""

    def test_deterministic(self, web3_uploader, sample_evidence):
        h1 = web3_uploader.compute_local_hash(sample_evidence)
        h2 = web3_uploader.compute_local_hash(sample_evidence)
        assert h1 == h2

    def test_different_data_different_hash(self, web3_uploader):
        h1 = web3_uploader.compute_local_hash({"a": 1})
        h2 = web3_uploader.compute_local_hash({"a": 2})
        assert h1 != h2

    def test_key_order_independent(self, web3_uploader):
        """sort_keys=True should make key order irrelevant."""
        h1 = web3_uploader.compute_local_hash({"b": 2, "a": 1})
        h2 = web3_uploader.compute_local_hash({"a": 1, "b": 2})
        assert h1 == h2


class TestWeb3StorageUpload:
    """web3.storage backend upload tests with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_successful_upload(self, web3_uploader, sample_evidence):
        """Mock a successful web3.storage response."""

        async def mock_post(*args, **kwargs):
            return _mock_response(
                200,
                json={"cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"},
            )

        web3_uploader._client = AsyncMock()
        web3_uploader._client.is_closed = False
        web3_uploader._client.post = mock_post

        cid = await web3_uploader.upload_json(sample_evidence)
        assert cid.startswith("bafybeig")

    @pytest.mark.asyncio
    async def test_upload_retry_on_500(self, web3_uploader, sample_evidence):
        """Should retry on HTTP 500 and succeed on second attempt."""
        call_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                resp = _mock_response(500, text="Internal Server Error")
                raise httpx.HTTPStatusError("500", request=resp.request, response=resp)
            return _mock_response(200, json={"cid": "bafyretried"})

        web3_uploader._client = AsyncMock()
        web3_uploader._client.is_closed = False
        web3_uploader._client.post = mock_post

        cid = await web3_uploader.upload_json(sample_evidence)
        assert cid == "bafyretried"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_upload_exhausts_retries(self, web3_uploader, sample_evidence):
        """Should raise FilecoinUploadError after all retries fail."""

        async def mock_post(*args, **kwargs):
            resp = _mock_response(503, text="Service Unavailable")
            raise httpx.HTTPStatusError("503", request=resp.request, response=resp)

        web3_uploader._client = AsyncMock()
        web3_uploader._client.is_closed = False
        web3_uploader._client.post = mock_post

        with pytest.raises(FilecoinUploadError, match="failed after 2 attempts"):
            await web3_uploader.upload_json(sample_evidence)

    @pytest.mark.asyncio
    async def test_upload_missing_cid_in_response(self, web3_uploader, sample_evidence):
        """Should raise if response JSON has no 'cid' key."""

        async def mock_post(*args, **kwargs):
            return _mock_response(200, json={"status": "ok"})

        web3_uploader._client = AsyncMock()
        web3_uploader._client.is_closed = False
        web3_uploader._client.post = mock_post

        with pytest.raises(FilecoinUploadError, match="missing 'cid'"):
            await web3_uploader.upload_json(sample_evidence)


class TestLighthouseUpload:
    """lighthouse.storage backend upload tests."""

    @pytest.mark.asyncio
    async def test_successful_lighthouse_upload(self, lighthouse_uploader, sample_evidence):
        async def mock_post(*args, **kwargs):
            return _mock_response(
                200,
                json={"Name": "evidence.json", "Hash": "QmTestHash12345", "Size": "1234"},
            )

        lighthouse_uploader._client = AsyncMock()
        lighthouse_uploader._client.is_closed = False
        lighthouse_uploader._client.post = mock_post

        cid = await lighthouse_uploader.upload_json(sample_evidence)
        assert cid == "QmTestHash12345"

    @pytest.mark.asyncio
    async def test_lighthouse_missing_hash(self, lighthouse_uploader, sample_evidence):
        async def mock_post(*args, **kwargs):
            return _mock_response(200, json={"Name": "x", "Size": "0"})

        lighthouse_uploader._client = AsyncMock()
        lighthouse_uploader._client.is_closed = False
        lighthouse_uploader._client.post = mock_post

        with pytest.raises(FilecoinUploadError, match="missing 'Hash'"):
            await lighthouse_uploader.upload_json(sample_evidence)


class TestContextManager:
    """Async context manager lifecycle."""

    @pytest.mark.asyncio
    async def test_context_manager(self):
        async with FilecoinUploader(api_token="test") as up:
            assert up._client is not None
            assert not up._client.is_closed
        # After exit, client should be closed
        assert up._client is None


class TestUploadBytes:
    """Raw bytes upload."""

    @pytest.mark.asyncio
    async def test_upload_raw_bytes(self, web3_uploader):
        async def mock_post(*args, **kwargs):
            return _mock_response(200, json={"cid": "bafyrawbytes"})

        web3_uploader._client = AsyncMock()
        web3_uploader._client.is_closed = False
        web3_uploader._client.post = mock_post

        cid = await web3_uploader.upload_bytes(b"raw data here", filename="data.bin")
        assert cid == "bafyrawbytes"
