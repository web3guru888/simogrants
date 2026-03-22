"""
attester.py — Attestation publisher for SIMOGRANTS.

Workflow:
  1. Compute evaluationHash = keccak256(evidence JSON).
  2. Compute projectHash    = keccak256(project_id string).
  3. Upload evidence bundle to Filecoin via FilecoinUploader.
  4. Call SIMOGrantsAttestation.publishAttestation() on-chain.
  5. Return transaction receipt + CID.

Usage:
    publisher = AttestationPublisher(
        rpc_url="https://mainnet.base.org",
        contract_address="0x...",
        private_key=os.environ["ATTESTER_PRIVATE_KEY"],
        filecoin_token=os.environ["WEB3STORAGE_TOKEN"],
    )
    result = await publisher.publish("project-42", {"scores": {...}})
    print(result.tx_hash, result.cid)
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

from .filecoin import FilecoinUploader

logger = logging.getLogger(__name__)

# ── ABI fragment (only the functions we call) ─────────────────────────
# Kept minimal to avoid shipping the full artifact; can be replaced by
# loading the compiled JSON from Hardhat.
_ATTESTATION_ABI: list[dict[str, Any]] = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "projectHash", "type": "bytes32"},
            {"internalType": "bytes32", "name": "evaluationHash", "type": "bytes32"},
            {"internalType": "string", "name": "filecoinCID", "type": "string"},
        ],
        "name": "publishAttestation",
        "outputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32[]", "name": "projectHashes", "type": "bytes32[]"},
            {"internalType": "bytes32[]", "name": "evaluationHashes", "type": "bytes32[]"},
            {"internalType": "string[]", "name": "filecoinCIDs", "type": "string[]"},
        ],
        "name": "publishBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "projectHash", "type": "bytes32"}],
        "name": "getAttestationCount",
        "outputs": [{"internalType": "uint256", "name": "count", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "projectHash", "type": "bytes32"}],
        "name": "getLatestAttestation",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "evaluationHash", "type": "bytes32"},
                    {"internalType": "string", "name": "filecoinCID", "type": "string"},
                    {"internalType": "uint64", "name": "timestamp", "type": "uint64"},
                    {"internalType": "address", "name": "attester", "type": "address"},
                    {"internalType": "uint64", "name": "epoch", "type": "uint64"},
                ],
                "internalType": "struct SIMOGrantsAttestation.Attestation",
                "name": "att",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "currentEpoch",
        "outputs": [{"internalType": "uint64", "name": "", "type": "uint64"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "totalAttestations",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def _keccak256(data: bytes) -> bytes:
    """Pure-Python Keccak-256 using eth_hash or hashlib fallback.

    Tries eth_hash (pycryptodome backend) first; falls back to pysha3/hashlib.
    """
    try:
        from eth_hash.auto import keccak  # type: ignore[import-untyped]
        return keccak(data)
    except ImportError:
        pass
    try:
        import sha3  # type: ignore[import-untyped]
        k = sha3.keccak_256()
        k.update(data)
        return k.digest()
    except ImportError:
        pass
    # Last resort: pycryptodome
    try:
        from Crypto.Hash import keccak as _k  # type: ignore[import-untyped]
        h = _k.new(digest_bits=256)
        h.update(data)
        return h.digest()
    except ImportError:
        raise ImportError(
            "No keccak implementation found. Install one of: "
            "eth-hash[pycryptodome], pysha3, pycryptodome"
        )


def compute_evaluation_hash(evidence: dict[str, Any]) -> bytes:
    """Compute keccak256 of the canonical JSON representation of evidence."""
    payload = json.dumps(evidence, separators=(",", ":"), sort_keys=True).encode()
    return _keccak256(payload)


def compute_project_hash(project_id: str) -> bytes:
    """Compute keccak256 of the UTF-8 encoded project identifier."""
    return _keccak256(project_id.encode("utf-8"))


# ── Result dataclass ──────────────────────────────────────────────────

@dataclass(frozen=True)
class AttestationResult:
    """Returned by :meth:`AttestationPublisher.publish`."""
    tx_hash: str
    block_number: int
    cid: str
    project_hash: str       # hex
    evaluation_hash: str    # hex
    gas_used: int
    epoch: int
    index: int              # on-chain array index


@dataclass(frozen=True)
class BatchAttestationResult:
    """Returned by :meth:`AttestationPublisher.publish_batch`."""
    tx_hash: str
    block_number: int
    cids: list[str]
    project_hashes: list[str]
    evaluation_hashes: list[str]
    gas_used: int
    count: int


# ── Publisher ─────────────────────────────────────────────────────────

class AttestationPublisher:
    """High-level async publisher that uploads evidence to Filecoin and
    writes attestations on-chain via the SIMOGrantsAttestation contract.

    Args:
        rpc_url:          JSON-RPC endpoint (Base mainnet or testnet).
        contract_address: Deployed SIMOGrantsAttestation address.
        private_key:      Hex-encoded private key of the attester.
                          **Never hardcode** — load from env.
        filecoin_token:   API token for the Filecoin uploader.
        filecoin_backend: ``"web3storage"`` or ``"lighthouse"``.
        chain_id:         Target chain ID (default 8453 = Base mainnet).
    """

    def __init__(
        self,
        rpc_url: str | None = None,
        contract_address: str | None = None,
        private_key: str | None = None,
        filecoin_token: str | None = None,
        filecoin_backend: str = "web3storage",
        chain_id: int = 8453,
    ) -> None:
        self.rpc_url = rpc_url or os.environ.get("BASE_RPC_URL", "https://mainnet.base.org")
        self.contract_address = contract_address or os.environ.get("ATTESTATION_CONTRACT", "")
        self._private_key = private_key or os.environ.get("ATTESTER_PRIVATE_KEY", "")
        self.chain_id = chain_id

        # Lazy-import web3 so the module can be imported without it installed.
        self._w3 = None
        self._contract = None
        self._account = None

        self.uploader = FilecoinUploader(
            api_token=filecoin_token,
            backend=filecoin_backend,
        )

    # ── Web3 setup (lazy) ─────────────────────────────────────────────

    def _init_web3(self) -> None:
        """Initialize Web3 connection and contract instance."""
        if self._w3 is not None:
            return

        from web3 import Web3  # type: ignore[import-untyped]
        from web3.middleware import ExtraDataToPOAMiddleware  # type: ignore[import-untyped]

        self._w3 = Web3(Web3.HTTPProvider(self.rpc_url))

        # Base is a PoA-like L2; inject middleware
        try:
            self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        except Exception:
            pass  # Some web3.py versions don't need this

        self._account = self._w3.eth.account.from_key(self._private_key)
        self._contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self.contract_address),
            abi=_ATTESTATION_ABI,
        )
        logger.info(
            "Web3 initialized — chain=%s  attester=%s  contract=%s",
            self._w3.eth.chain_id,
            self._account.address,
            self.contract_address,
        )

    # ── Public API ────────────────────────────────────────────────────

    async def publish(
        self,
        project_id: str,
        evidence: dict[str, Any],
        *,
        gas_limit: int | None = None,
    ) -> AttestationResult:
        """End-to-end publish: hash → upload → attest on-chain.

        Args:
            project_id: Human-readable project identifier.
            evidence:   Full evidence JSON dict (~50 KB).
            gas_limit:  Optional gas limit override.

        Returns:
            AttestationResult with tx hash, CID, hashes, and more.
        """
        self._init_web3()
        assert self._w3 and self._contract and self._account  # mypy

        # 1. Compute hashes
        eval_hash = compute_evaluation_hash(evidence)
        proj_hash = compute_project_hash(project_id)

        logger.info(
            "Publishing attestation — project=%s  evalHash=%s",
            project_id,
            eval_hash.hex(),
        )

        # 2. Upload evidence to Filecoin
        cid = await self.uploader.upload_json(evidence)
        logger.info("Evidence uploaded — CID=%s", cid)

        # 3. Build + sign + send transaction
        tx = self._contract.functions.publishAttestation(
            proj_hash, eval_hash, cid
        ).build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "chainId": self.chain_id,
                **({"gas": gas_limit} if gas_limit else {}),
            }
        )

        signed = self._account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        logger.info(
            "Attestation published — tx=%s  block=%s  gas=%s",
            receipt["transactionHash"].hex(),
            receipt["blockNumber"],
            receipt["gasUsed"],
        )

        # 4. Decode index from logs (or read from chain)
        count = self._contract.functions.getAttestationCount(proj_hash).call()
        epoch = self._contract.functions.currentEpoch().call()

        return AttestationResult(
            tx_hash=receipt["transactionHash"].hex(),
            block_number=receipt["blockNumber"],
            cid=cid,
            project_hash="0x" + proj_hash.hex(),
            evaluation_hash="0x" + eval_hash.hex(),
            gas_used=receipt["gasUsed"],
            epoch=epoch,
            index=count - 1,
        )

    async def publish_batch(
        self,
        items: list[dict[str, Any]],
        *,
        gas_limit: int | None = None,
    ) -> BatchAttestationResult:
        """Publish a batch of attestations in a single transaction.

        Each item in *items* must have keys ``"project_id"`` and ``"evidence"``.
        """
        self._init_web3()
        assert self._w3 and self._contract and self._account

        proj_hashes: list[bytes] = []
        eval_hashes: list[bytes] = []
        cids: list[str] = []

        for item in items:
            pid = item["project_id"]
            ev = item["evidence"]
            proj_hashes.append(compute_project_hash(pid))
            eval_hashes.append(compute_evaluation_hash(ev))
            cid = await self.uploader.upload_json(ev)
            cids.append(cid)

        tx = self._contract.functions.publishBatch(
            proj_hashes, eval_hashes, cids
        ).build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "chainId": self.chain_id,
                **({"gas": gas_limit} if gas_limit else {}),
            }
        )

        signed = self._account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

        return BatchAttestationResult(
            tx_hash=receipt["transactionHash"].hex(),
            block_number=receipt["blockNumber"],
            cids=cids,
            project_hashes=["0x" + h.hex() for h in proj_hashes],
            evaluation_hashes=["0x" + h.hex() for h in eval_hashes],
            gas_used=receipt["gasUsed"],
            count=len(items),
        )

    # ── Read helpers ──────────────────────────────────────────────────

    async def get_attestation_count(self, project_id: str) -> int:
        """Return the on-chain attestation count for a project."""
        self._init_web3()
        assert self._contract
        ph = compute_project_hash(project_id)
        return self._contract.functions.getAttestationCount(ph).call()

    async def get_latest_attestation(self, project_id: str) -> dict[str, Any]:
        """Return the latest attestation for a project as a dict."""
        self._init_web3()
        assert self._contract
        ph = compute_project_hash(project_id)
        att = self._contract.functions.getLatestAttestation(ph).call()
        return {
            "evaluationHash": "0x" + att[0].hex(),
            "filecoinCID": att[1],
            "timestamp": att[2],
            "attester": att[3],
            "epoch": att[4],
        }

    async def get_current_epoch(self) -> int:
        """Return the current on-chain epoch."""
        self._init_web3()
        assert self._contract
        return self._contract.functions.currentEpoch().call()

    async def get_total_attestations(self) -> int:
        """Return the global attestation counter."""
        self._init_web3()
        assert self._contract
        return self._contract.functions.totalAttestations().call()

    # ── Cleanup ───────────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the Filecoin uploader's HTTP client."""
        await self.uploader.close()

    async def __aenter__(self) -> "AttestationPublisher":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()

    def __repr__(self) -> str:
        return (
            f"AttestationPublisher(rpc={self.rpc_url!r}, "
            f"contract={self.contract_address!r}, chain={self.chain_id})"
        )
