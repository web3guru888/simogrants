"""
SIMOGRANTS Blockchain — On-chain attestation layer for Ethereum public goods evaluation.

Modules:
    filecoin  — Async Filecoin / IPFS uploader (web3.storage + lighthouse.storage).
    attester  — Attestation publisher that hashes evidence, uploads to Filecoin,
                and writes on-chain attestations via SIMOGrantsAttestation.sol.
"""

from .filecoin import FilecoinUploader
from .attester import AttestationPublisher

__all__ = ["FilecoinUploader", "AttestationPublisher"]
__version__ = "0.1.0"
