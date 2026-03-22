"""
filecoin.py — Async Filecoin / IPFS uploader for SIMOGRANTS evidence bundles.

Supports two backends:
  1. web3.storage (W3S) — default
  2. lighthouse.storage — fallback

Usage:
    uploader = FilecoinUploader(api_token="...", backend="web3storage")
    cid = await uploader.upload_json({"evidence": "..."})
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from enum import Enum
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class Backend(str, Enum):
    """Supported storage backends."""
    WEB3STORAGE = "web3storage"
    LIGHTHOUSE = "lighthouse"


# ── Backend endpoint config ───────────────────────────────────────────
_BACKEND_CONFIG: dict[str, dict[str, str]] = {
    Backend.WEB3STORAGE: {
        "upload_url": "https://api.web3.storage/upload",
        "auth_header": "Authorization",
        "auth_prefix": "Bearer ",
    },
    Backend.LIGHTHOUSE: {
        "upload_url": "https://node.lighthouse.storage/api/v0/add",
        "auth_header": "Authorization",
        "auth_prefix": "Bearer ",
    },
}


class FilecoinUploadError(Exception):
    """Raised when an upload to Filecoin / IPFS permanently fails."""


class FilecoinUploader:
    """Async uploader for JSON evidence bundles to Filecoin-backed storage.

    Args:
        api_token: API token for the chosen backend.  Falls back to env vars
                   ``WEB3STORAGE_TOKEN`` or ``LIGHTHOUSE_TOKEN``.
        backend:   One of ``"web3storage"`` or ``"lighthouse"``.
        max_retries: Number of retry attempts on transient failure.
        retry_backoff: Base delay (seconds) between retries (exponential).
        timeout: HTTP request timeout in seconds.
    """

    def __init__(
        self,
        api_token: str | None = None,
        backend: str = "web3storage",
        max_retries: int = 3,
        retry_backoff: float = 1.0,
        timeout: float = 30.0,
    ) -> None:
        self.backend = Backend(backend)
        self.api_token = api_token or self._token_from_env()
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
        self.timeout = timeout
        self._cfg = _BACKEND_CONFIG[self.backend]
        self._client: httpx.AsyncClient | None = None

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def close(self) -> None:
        """Gracefully close the underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> "FilecoinUploader":
        await self._get_client()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()

    # ── Public API ────────────────────────────────────────────────────

    async def upload_json(self, data: dict[str, Any]) -> str:
        """Serialize *data* to compact JSON and upload.

        Returns:
            The CID (content identifier) string for the uploaded file.

        Raises:
            FilecoinUploadError: After all retries are exhausted.
        """
        payload = json.dumps(data, separators=(",", ":"), sort_keys=True).encode()
        return await self.upload_bytes(payload, filename="evidence.json")

    async def upload_bytes(self, data: bytes, filename: str = "data.bin") -> str:
        """Upload raw bytes to the configured backend.

        Returns:
            The CID string.
        """
        logger.info(
            "Uploading %d bytes to %s (file=%s)",
            len(data),
            self.backend.value,
            filename,
        )
        return await self._upload_with_retry(data, filename)

    def compute_local_hash(self, data: dict[str, Any]) -> str:
        """Compute a deterministic SHA-256 hex digest of the JSON payload.

        Useful for pre-upload deduplication or integrity checks.
        """
        payload = json.dumps(data, separators=(",", ":"), sort_keys=True).encode()
        return hashlib.sha256(payload).hexdigest()

    # ── Internal ──────────────────────────────────────────────────────

    def _token_from_env(self) -> str:
        env_map = {
            Backend.WEB3STORAGE: "WEB3STORAGE_TOKEN",
            Backend.LIGHTHOUSE: "LIGHTHOUSE_TOKEN",
        }
        key = env_map[self.backend]
        token = os.environ.get(key, "")
        if not token:
            logger.warning("No API token provided and %s is not set.", key)
        return token

    async def _upload_with_retry(self, data: bytes, filename: str) -> str:
        """Attempt upload with exponential-backoff retry."""
        client = await self._get_client()
        last_err: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                cid = await self._do_upload(client, data, filename)
                logger.info("Upload succeeded on attempt %d — CID: %s", attempt, cid)
                return cid
            except (httpx.HTTPStatusError, httpx.TransportError, httpx.TimeoutException) as exc:
                last_err = exc
                delay = self.retry_backoff * (2 ** (attempt - 1))
                logger.warning(
                    "Upload attempt %d/%d failed (%s). Retrying in %.1fs …",
                    attempt,
                    self.max_retries,
                    exc,
                    delay,
                )
                # async sleep via httpx internals would need asyncio
                import asyncio
                await asyncio.sleep(delay)

        raise FilecoinUploadError(
            f"Upload failed after {self.max_retries} attempts: {last_err}"
        ) from last_err

    async def _do_upload(self, client: httpx.AsyncClient, data: bytes, filename: str) -> str:
        """Execute a single upload request and parse the CID from the response."""
        headers = {
            self._cfg["auth_header"]: f"{self._cfg['auth_prefix']}{self.api_token}",
        }

        if self.backend == Backend.WEB3STORAGE:
            # web3.storage accepts raw body with Content-Type
            headers["Content-Type"] = "application/json"
            # For the /upload endpoint with a CAR, but for simple uploads
            # the /upload endpoint also works with raw bytes.
            # We use the simpler POST /upload with the file body.
            headers["X-Name"] = filename
            resp = await client.post(
                self._cfg["upload_url"],
                content=data,
                headers=headers,
            )
            resp.raise_for_status()
            body = resp.json()
            # web3.storage returns {"cid": "bafy..."} 
            cid: str = body.get("cid", "")
            if not cid:
                raise FilecoinUploadError(
                    f"web3.storage response missing 'cid': {body}"
                )
            return cid

        elif self.backend == Backend.LIGHTHOUSE:
            # lighthouse uses multipart form upload
            files = {"file": (filename, data, "application/json")}
            resp = await client.post(
                self._cfg["upload_url"],
                files=files,
                headers=headers,
            )
            resp.raise_for_status()
            body = resp.json()
            # lighthouse returns {"Name": "...", "Hash": "Qm...", "Size": "..."}
            cid = body.get("Hash", "")
            if not cid:
                raise FilecoinUploadError(
                    f"lighthouse response missing 'Hash': {body}"
                )
            return cid

        raise FilecoinUploadError(f"Unknown backend: {self.backend}")

    # ── Repr ──────────────────────────────────────────────────────────

    def __repr__(self) -> str:
        masked = f"{self.api_token[:6]}…" if len(self.api_token) > 6 else "***"
        return (
            f"FilecoinUploader(backend={self.backend.value!r}, "
            f"token={masked}, retries={self.max_retries})"
        )
