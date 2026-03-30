// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AttestationRegistry
 * @notice On-chain attestation layer for SIMOGRANTS evaluation results.
 *         Records evaluation hashes with evidence URIs (R2 or IPFS/Filecoin).
 *         Extends the existing SIMOGrantsAttestation contract with:
 *         - Support for R2 URIs (not just Filecoin CIDs)
 *         - Batch attestation publishing
 *         - Better structured attestation data
 *         - Gas-efficient storage
 *
 * @dev Follows ERC-8004 compliance patterns:
 *      - Agent identity is the attester address.
 *      - evaluationHash serves as the "receipt" of work performed.
 *      - evidenceURI provides a verifiable evidence trail (R2, IPFS, or Filecoin).
 *      - Events enable efficient off-chain indexing.
 */
contract AttestationRegistry {
    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    struct Attestation {
        bytes32 evaluationHash;  // keccak256 of the evidence JSON
        string  evidenceURI;     // R2 URL, IPFS URI, or Filecoin CID
        uint64  timestamp;       // block.timestamp at publication
        address attester;        // msg.sender that published
        uint64  epoch;           // evaluation epoch
        uint8   source;          // 0 = IPFS/Filecoin, 1 = R2, 2 = other
    }

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────

    uint8 public constant SOURCE_IPFS = 0;
    uint8 public constant SOURCE_R2 = 1;
    uint8 public constant SOURCE_OTHER = 2;

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    address public owner;
    uint64 public currentEpoch;

    /// @notice projectHash => ordered list of attestations.
    mapping(bytes32 => Attestation[]) private _attestations;

    /// @notice Addresses authorized to publish attestations.
    mapping(address => bool) public authorizedAttesters;

    /// @notice Global counter for total attestations published.
    uint256 public totalAttestations;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event AttestationPublished(
        bytes32 indexed projectHash,
        bytes32 indexed evaluationHash,
        string  evidenceURI,
        address indexed attester,
        uint64  epoch,
        uint256 index
    );
    event EpochAdvanced(uint64 oldEpoch, uint64 newEpoch);
    event AttesterUpdated(address indexed attester, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error OnlyOwner();
    error NotAuthorized();
    error EmptyURI();
    error ZeroEvaluationHash();
    error ZeroProjectHash();
    error ZeroAddress();
    error NoAttestations();
    error BatchLengthMismatch();
    error InvalidSource();

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizedAttesters[msg.sender] && msg.sender != owner)
            revert NotAuthorized();
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        authorizedAttesters[msg.sender] = true;
        currentEpoch = 0;
        emit AttesterUpdated(msg.sender, true);
    }

    // ──────────────────────────────────────────────
    // Attestation — single
    // ──────────────────────────────────────────────

    /// @notice Publish a single attestation for a project.
    /// @param projectHash keccak256 of the project identifier.
    /// @param evaluationHash keccak256 of the full evidence JSON.
    /// @param evidenceURI R2 URL, IPFS URI, or Filecoin CID.
    /// @param source Evidence source: 0=IPFS, 1=R2, 2=other.
    /// @return index The index of the new attestation.
    function publishAttestation(
        bytes32 projectHash,
        bytes32 evaluationHash,
        string calldata evidenceURI,
        uint8 source
    ) external onlyAuthorized returns (uint256 index) {
        if (projectHash == bytes32(0)) revert ZeroProjectHash();
        if (evaluationHash == bytes32(0)) revert ZeroEvaluationHash();
        if (bytes(evidenceURI).length == 0) revert EmptyURI();
        if (source > SOURCE_OTHER) revert InvalidSource();

        index = _attestations[projectHash].length;
        _attestations[projectHash].push(Attestation({
            evaluationHash: evaluationHash,
            evidenceURI: evidenceURI,
            timestamp: uint64(block.timestamp),
            attester: msg.sender,
            epoch: currentEpoch,
            source: source
        }));

        unchecked { totalAttestations++; }

        emit AttestationPublished(
            projectHash, evaluationHash, evidenceURI,
            msg.sender, currentEpoch, index
        );
    }

    /// @notice Publish attestation with auto-detected source.
    function publishAttestation(
        bytes32 projectHash,
        bytes32 evaluationHash,
        string calldata evidenceURI
    ) external onlyAuthorized returns (uint256 index) {
        if (projectHash == bytes32(0)) revert ZeroProjectHash();
        if (evaluationHash == bytes32(0)) revert ZeroEvaluationHash();
        if (bytes(evidenceURI).length == 0) revert EmptyURI();

        uint8 source = _detectSource(evidenceURI);
        index = _attestations[projectHash].length;
        _attestations[projectHash].push(Attestation({
            evaluationHash: evaluationHash,
            evidenceURI: evidenceURI,
            timestamp: uint64(block.timestamp),
            attester: msg.sender,
            epoch: currentEpoch,
            source: source
        }));

        unchecked { totalAttestations++; }

        emit AttestationPublished(
            projectHash, evaluationHash, evidenceURI,
            msg.sender, currentEpoch, index
        );
    }

    // ──────────────────────────────────────────────
    // Attestation — batch (gas-optimized)
    // ──────────────────────────────────────────────

    /// @notice Publish multiple attestations in a single transaction.
    function publishBatch(
        bytes32[] calldata projectHashes,
        bytes32[] calldata evaluationHashes,
        string[]  calldata evidenceURIs,
        uint8[]   calldata sources
    ) external onlyAuthorized {
        uint256 len = projectHashes.length;
        if (len != evaluationHashes.length || len != evidenceURIs.length)
            revert BatchLengthMismatch();

        uint64 epoch = currentEpoch;
        uint64 ts = uint64(block.timestamp);
        address att = msg.sender;

        for (uint256 i; i < len; ) {
            bytes32 ph = projectHashes[i];
            bytes32 eh = evaluationHashes[i];
            string calldata uri = evidenceURIs[i];
            uint8 src = sources.length > 0 ? sources[i] : _detectSourceInline(uri);

            if (ph == bytes32(0)) revert ZeroProjectHash();
            if (eh == bytes32(0)) revert ZeroEvaluationHash();
            if (bytes(uri).length == 0) revert EmptyURI();
            if (src > SOURCE_OTHER) revert InvalidSource();

            uint256 idx = _attestations[ph].length;
            _attestations[ph].push(Attestation({
                evaluationHash: eh,
                evidenceURI: uri,
                timestamp: ts,
                attester: att,
                epoch: epoch,
                source: src
            }));

            emit AttestationPublished(ph, eh, uri, att, epoch, idx);

            unchecked { ++i; }
        }

        unchecked { totalAttestations += len; }
    }

    /// @notice Publish batch without explicit sources (auto-detect).
    function publishBatch(
        bytes32[] calldata projectHashes,
        bytes32[] calldata evaluationHashes,
        string[]  calldata evidenceURIs
    ) external onlyAuthorized {
        uint256 len = projectHashes.length;
        if (len != evaluationHashes.length || len != evidenceURIs.length)
            revert BatchLengthMismatch();

        uint64 epoch = currentEpoch;
        uint64 ts = uint64(block.timestamp);
        address att = msg.sender;

        for (uint256 i; i < len; ) {
            bytes32 ph = projectHashes[i];
            bytes32 eh = evaluationHashes[i];
            string calldata uri = evidenceURIs[i];

            if (ph == bytes32(0)) revert ZeroProjectHash();
            if (eh == bytes32(0)) revert ZeroEvaluationHash();
            if (bytes(uri).length == 0) revert EmptyURI();

            uint256 idx = _attestations[ph].length;
            _attestations[ph].push(Attestation({
                evaluationHash: eh,
                evidenceURI: uri,
                timestamp: ts,
                attester: att,
                epoch: epoch,
                source: _detectSourceInline(uri)
            }));

            emit AttestationPublished(ph, eh, uri, att, epoch, idx);

            unchecked { ++i; }
        }

        unchecked { totalAttestations += len; }
    }

    // ──────────────────────────────────────────────
    // Epoch management
    // ──────────────────────────────────────────────

    function advanceEpoch() external onlyOwner returns (uint64) {
        uint64 old = currentEpoch;
        unchecked { ++currentEpoch; }
        emit EpochAdvanced(old, currentEpoch);
        return currentEpoch;
    }

    // ──────────────────────────────────────────────
    // Attester management
    // ──────────────────────────────────────────────

    function setAttester(address attester, bool authorized) external onlyOwner {
        if (attester == address(0)) revert ZeroAddress();
        authorizedAttesters[attester] = authorized;
        emit AttesterUpdated(attester, authorized);
    }

    // ──────────────────────────────────────────────
    // Ownership
    // ──────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    function getAttestationCount(bytes32 projectHash) external view returns (uint256) {
        return _attestations[projectHash].length;
    }

    function getLatestAttestation(bytes32 projectHash)
        external view returns (Attestation memory)
    {
        uint256 len = _attestations[projectHash].length;
        if (len == 0) revert NoAttestations();
        return _attestations[projectHash][len - 1];
    }

    function getAttestation(bytes32 projectHash, uint256 index)
        external view returns (Attestation memory)
    {
        return _attestations[projectHash][index];
    }

    function getAllAttestations(bytes32 projectHash)
        external view returns (Attestation[] memory)
    {
        return _attestations[projectHash];
    }

    // ──────────────────────────────────────────────
    // Source detection (view functions — not used in batch for gas)
    // ──────────────────────────────────────────────

    function _detectSource(string calldata uri) public pure returns (uint8) {
        return _detectSourceInline(uri);
    }

    function _detectSourceInline(string calldata uri) internal pure returns (uint8) {
        bytes calldata b = bytes(uri);
        // Check for "r2." or "cloudflare" in URI → R2
        if (b.length > 3) {
            // Simple check: R2 URLs often contain "r2." or "/r2/"
            if (_contains(b, "r2.")) return SOURCE_R2;
            if (_contains(b, "cloudflare")) return SOURCE_R2;
            // IPFS URIs start with "Qm" or "bafy"
            if (b.length > 2 && b[0] == 0x51 && b[1] == 0x6d) return SOURCE_IPFS; // "Qm"
            if (b.length > 4 && b[0] == 0x62 && b[1] == 0x61 && b[2] == 0x66 && b[3] == 0x79) return SOURCE_IPFS; // "bafy"
            if (_contains(b, "ipfs")) return SOURCE_IPFS;
        }
        return SOURCE_OTHER;
    }

    function _contains(bytes calldata haystack, bytes memory needle) internal pure returns (bool) {
        if (haystack.length < needle.length) return false;
        for (uint256 i; i <= haystack.length - needle.length; ) {
            bool found = true;
            for (uint256 j; j < needle.length; ) {
                if (haystack[i + j] != needle[j]) {
                    found = false;
                    break;
                }
                unchecked { ++j; }
            }
            if (found) return true;
            unchecked { ++i; }
        }
        return false;
    }
}
