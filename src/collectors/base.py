"""
SIMOGRANTS Base Collector
=========================
Abstract base class that every source-specific collector inherits from.
Provides a unified interface, automatic retries, timeout handling, and
structured error reporting.
"""
from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from .models import CollectionMeta, CollectorStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

DEFAULT_TIMEOUT = 30.0          # seconds per HTTP request
DEFAULT_RETRIES = 3             # max retry attempts
DEFAULT_BACKOFF_BASE = 1.5      # exponential backoff base (seconds)
DEFAULT_USER_AGENT = "SIMOGRANTS-Collector/1.0 (https://github.com/simogrants)"


class BaseCollector(ABC):
    """
    Abstract base class for all SIMOGRANTS data collectors.

    Subclasses **must** implement:
        ``_collect_impl(identifier)`` → dict of source-specific data.

    The public ``collect()`` method wraps ``_collect_impl`` with retries,
    timeout protection, and structured metadata tracking.
    """

    # Each subclass should set this to a descriptive string, e.g. "github".
    source_name: str = "unknown"

    def __init__(
        self,
        *,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_RETRIES,
        backoff_base: float = DEFAULT_BACKOFF_BASE,
        api_key: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.api_key = api_key
        self._extra_headers = headers or {}
        self._client: Optional[httpx.AsyncClient] = None

    # ------------------------------------------------------------------
    # HTTP client lifecycle
    # ------------------------------------------------------------------

    async def _get_client(self) -> httpx.AsyncClient:
        """Return a shared ``httpx.AsyncClient``, creating one if needed."""
        if self._client is None or self._client.is_closed:
            base_headers = {
                "User-Agent": DEFAULT_USER_AGENT,
                "Accept": "application/json",
            }
            base_headers.update(self._extra_headers)
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                headers=base_headers,
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------
    # Convenience HTTP helpers
    # ------------------------------------------------------------------

    async def _get_json(
        self,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """
        Perform a GET request and return the parsed JSON body.

        Raises ``httpx.HTTPStatusError`` on 4xx/5xx responses.
        """
        client = await self._get_client()
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def _get_text(
        self,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> str:
        """Perform a GET request and return the response text."""
        client = await self._get_client()
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.text

    async def _post_json(
        self,
        url: str,
        *,
        json_body: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Perform a POST request with a JSON body and return parsed JSON."""
        client = await self._get_client()
        resp = await client.post(url, json=json_body, headers=headers)
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Retry wrapper
    # ------------------------------------------------------------------

    async def _retry(self, coro_factory, *, identifier: str) -> Any:
        """
        Execute an async callable with exponential-backoff retries.

        Parameters
        ----------
        coro_factory:
            A zero-argument async callable that will be awaited on each attempt.
        identifier:
            Used only for logging context.

        Returns
        -------
        The return value of *coro_factory* on the first successful call.

        Raises
        ------
        The last exception encountered after exhausting all retries.
        """
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                return await coro_factory()
            except (httpx.HTTPStatusError, httpx.RequestError, asyncio.TimeoutError) as exc:
                last_exc = exc
                wait = self.backoff_base ** attempt
                logger.warning(
                    "[%s] Attempt %d/%d for '%s' failed: %s — retrying in %.1fs",
                    self.source_name, attempt, self.max_retries,
                    identifier, exc, wait,
                )
                await asyncio.sleep(wait)
        # All retries exhausted
        raise last_exc  # type: ignore[misc]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def collect(self, identifier: str) -> Dict[str, Any]:
        """
        Collect data for *identifier* with retries and metadata tracking.

        Parameters
        ----------
        identifier:
            A source-appropriate identifier — e.g. ``"owner/repo"`` for
            GitHub, an Ethereum address for Etherscan, etc.

        Returns
        -------
        dict with keys:
            - ``"data"``: the source-specific data dict (or ``{}`` on failure).
            - ``"meta"``: a :class:`CollectionMeta` instance.
        """
        meta = CollectionMeta(
            source=self.source_name,
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        t0 = time.monotonic()
        data: Dict[str, Any] = {}
        try:
            data = await self._retry(
                lambda: self._collect_impl(identifier),
                identifier=identifier,
            )
            meta.status = CollectorStatus.SUCCESS
        except Exception as exc:
            logger.error(
                "[%s] Collection FAILED for '%s': %s",
                self.source_name, identifier, exc,
            )
            meta.status = CollectorStatus.FAILED
            meta.error_message = str(exc)
        finally:
            meta.finished_at = datetime.now(timezone.utc).isoformat()
            meta.duration_seconds = round(time.monotonic() - t0, 3)

        return {"data": data, "meta": meta}

    # ------------------------------------------------------------------
    # Abstract hook
    # ------------------------------------------------------------------

    @abstractmethod
    async def _collect_impl(self, identifier: str) -> Dict[str, Any]:
        """
        Source-specific collection logic.  Subclasses **must** override this.

        Parameters
        ----------
        identifier:
            The lookup key for the source.

        Returns
        -------
        dict mapping field names to their values.  The caller will use
        this to populate the corresponding dataclass.
        """
        ...  # pragma: no cover
