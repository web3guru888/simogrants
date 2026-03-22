"""
SIMOGRANTS Etherscan Collector
===============================
Gathers on-chain data for an Ethereum address: balance, transaction count,
contract verification status, recent transactions, and token transfers.

Identifier format: ``"0x..."`` Ethereum address.

Requires an Etherscan API key (free tier: 5 req/s).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .base import BaseCollector
from .models import EtherscanData

logger = logging.getLogger(__name__)

ETHERSCAN_API = "https://api.etherscan.io/api"


class EtherscanCollector(BaseCollector):
    """Collector for Etherscan on-chain data."""

    source_name: str = "etherscan"

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            api_key=api_key,
            timeout=timeout,
            max_retries=max_retries,
            **kwargs,
        )
        self._api_key = api_key or ""

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _etherscan_get(self, **params: Any) -> Any:
        """Call the Etherscan API with common parameters."""
        params["apikey"] = self._api_key
        data = await self._get_json(ETHERSCAN_API, params=params)
        if isinstance(data, dict) and data.get("status") == "0":
            msg = data.get("message", "") or data.get("result", "")
            # "No transactions found" is not a real error
            if "no transactions" in str(msg).lower():
                return []
            if "rate limit" in str(msg).lower() or "max rate" in str(msg).lower():
                raise RuntimeError(f"Etherscan rate limit: {msg}")
        return data.get("result", data) if isinstance(data, dict) else data

    async def _get_balance(self, address: str) -> int:
        """Return balance in wei."""
        result = await self._etherscan_get(
            module="account", action="balance", address=address, tag="latest",
        )
        try:
            return int(result)
        except (ValueError, TypeError):
            return 0

    async def _get_tx_count(self, address: str) -> int:
        """Approximate tx count via recent normal transactions (max 10000)."""
        result = await self._etherscan_get(
            module="account", action="txlist", address=address,
            startblock="0", endblock="99999999",
            page="1", offset="1", sort="desc",
        )
        # Etherscan doesn't expose nonce directly; we count returned txs
        # For real count, we'd use proxy module getTransactionCount
        try:
            proxy_result = await self._etherscan_get(
                module="proxy", action="eth_getTransactionCount",
                address=address, tag="latest",
            )
            return int(proxy_result, 16) if isinstance(proxy_result, str) else 0
        except Exception:
            return len(result) if isinstance(result, list) else 0

    async def _is_contract(self, address: str) -> bool:
        """Check if address is a contract by fetching its bytecode."""
        try:
            result = await self._etherscan_get(
                module="proxy", action="eth_getCode",
                address=address, tag="latest",
            )
            return isinstance(result, str) and result not in ("0x", "0x0", "")
        except Exception:
            return False

    async def _get_contract_info(self, address: str) -> Dict[str, Any]:
        """Fetch contract ABI / verification status."""
        try:
            result = await self._etherscan_get(
                module="contract", action="getsourcecode", address=address,
            )
            if isinstance(result, list) and len(result) > 0:
                item = result[0]
                return {
                    "contract_name": item.get("ContractName", ""),
                    "contract_verified": bool(item.get("ABI") and item["ABI"] != "Contract source code not verified"),
                }
        except Exception:
            pass
        return {"contract_name": "", "contract_verified": False}

    async def _get_recent_transactions(
        self, address: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Fetch recent normal transactions."""
        result = await self._etherscan_get(
            module="account", action="txlist", address=address,
            startblock="0", endblock="99999999",
            page="1", offset=str(limit), sort="desc",
        )
        if not isinstance(result, list):
            return []
        txs: List[Dict[str, Any]] = []
        for tx in result[:limit]:
            txs.append({
                "hash": tx.get("hash", ""),
                "from": tx.get("from", ""),
                "to": tx.get("to", ""),
                "value": tx.get("value", "0"),
                "gas_used": tx.get("gasUsed", "0"),
                "timestamp": tx.get("timeStamp", ""),
                "is_error": tx.get("isError", "0"),
            })
        return txs

    async def _get_token_transfers(
        self, address: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Fetch ERC-20 token transfer events."""
        result = await self._etherscan_get(
            module="account", action="tokentx", address=address,
            startblock="0", endblock="99999999",
            page="1", offset=str(limit), sort="desc",
        )
        if not isinstance(result, list):
            return []
        return [
            {
                "token_name": t.get("tokenName", ""),
                "token_symbol": t.get("tokenSymbol", ""),
                "from": t.get("from", ""),
                "to": t.get("to", ""),
                "value": t.get("value", "0"),
                "timestamp": t.get("timeStamp", ""),
            }
            for t in result[:limit]
        ]

    # ------------------------------------------------------------------
    # Main implementation
    # ------------------------------------------------------------------

    async def _collect_impl(self, identifier: str) -> Dict[str, Any]:
        """
        Collect Etherscan data for an Ethereum address.

        Parameters
        ----------
        identifier:
            ``"0x..."`` Ethereum address.
        """
        address = identifier.strip()
        if not address.startswith("0x") or len(address) != 42:
            raise ValueError(f"Invalid Ethereum address: {address!r}")

        # Parallel sub-fetches
        balance_task = asyncio.create_task(self._get_balance(address))
        tx_count_task = asyncio.create_task(self._get_tx_count(address))
        is_contract_task = asyncio.create_task(self._is_contract(address))
        txs_task = asyncio.create_task(self._get_recent_transactions(address))
        tokens_task = asyncio.create_task(self._get_token_transfers(address))

        balance_wei = await balance_task
        tx_count = await tx_count_task
        is_contract = await is_contract_task

        contract_info: Dict[str, Any] = {"contract_name": "", "contract_verified": False}
        if is_contract:
            try:
                contract_info = await self._get_contract_info(address)
            except Exception as exc:
                logger.warning("[etherscan] contract info failed: %s", exc)

        recent_txs: List[Dict[str, Any]] = []
        try:
            recent_txs = await txs_task
        except Exception as exc:
            logger.warning("[etherscan] recent txs failed: %s", exc)

        token_transfers: List[Dict[str, Any]] = []
        try:
            token_transfers = await tokens_task
        except Exception as exc:
            logger.warning("[etherscan] token transfers failed: %s", exc)

        # Derived stats from recent txs
        senders = set()
        receivers = set()
        total_gas = 0
        first_ts: Optional[str] = None
        last_ts: Optional[str] = None
        for tx in recent_txs:
            senders.add(tx.get("from", ""))
            receivers.add(tx.get("to", ""))
            try:
                total_gas += int(tx.get("gas_used", 0))
            except (ValueError, TypeError):
                pass
        if recent_txs:
            last_ts = recent_txs[0].get("timestamp")
            first_ts = recent_txs[-1].get("timestamp")

        return {
            "address": address,
            "chain": "ethereum",
            "balance_wei": balance_wei,
            "balance_eth": round(balance_wei / 1e18, 6),
            "tx_count": tx_count,
            "is_contract": is_contract,
            "contract_name": contract_info.get("contract_name", ""),
            "contract_verified": contract_info.get("contract_verified", False),
            "token_transfers_count": len(token_transfers),
            "erc20_tokens": token_transfers[:10],
            "recent_transactions": recent_txs[:10],
            "first_tx_timestamp": first_ts,
            "last_tx_timestamp": last_ts,
            "unique_senders": len(senders),
            "unique_receivers": len(receivers),
            "total_gas_used": total_gas,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def to_dataclass(data: Dict[str, Any]) -> EtherscanData:
        """Convert raw data dict to :class:`EtherscanData`."""
        return EtherscanData(**{
            k: v for k, v in data.items()
            if k in EtherscanData.__dataclass_fields__
        })
