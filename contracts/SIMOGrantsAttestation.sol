// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SIMOGrantsAttestation
 * @author SIMOGRANTS Blockchain Agent
 * @notice On-chain attestation layer for Ethereum public goods evaluation.
 *         Each attestation records an evaluation hash, a Filecoin CID pointing
 *         to the full evidence bundle, and the current epoch.
 * @dev    Follows ERC-8004 compliance patterns:
 *         - Agent identity is the attester address.
 *         - evaluationHash serves as the "receipt" of work performed.
 *         - filecoinCID provides a verifiable evidence trail.
 *         - Events enable efficient off-chain indexing.
 *
 *         Target chain: Base (chain ID 8453) / Base Sepolia (84532).
 */
contract SIMOGrantsAttestation {
    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    /// @notice A single attestation record.
    struct Attestation {
        bytes32 evaluationHash;  // keccak256 of the evidence JSON
        string  filecoinCID;     // IPFS / Filecoin CID of evidence bundle
        uint64  timestamp;       // block.timestamp at publication
        address attester;        // msg.sender that published
        uint64  epoch;           // governance epoch at publication
    }

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    /// @notice Contract owner (deployer). Controls epoch advancement and
    ///         attester authorization.
    address public owner;

    /// @notice Current evaluation epoch (monotonically increasing).
    uint64 public currentEpoch;

    /// @notice projectHash ⇒ ordered list of attestations.
    mapping(bytes32 => Attestation[]) private _attestations;

    /// @notice Addresses authorized to publish attestations.
    mapping(address => bool) public authorizedAttesters;

    /// @notice Global counter for total attestations published.
    uint256 public totalAttestations;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new attestation is published.
    /// @param projectHash  keccak256 of the project identifier.
    /// @param evaluationHash keccak256 of the evidence JSON.
    /// @param filecoinCID  CID of the evidence bundle on Filecoin / IPFS.
    /// @param attester     Address that published the attestation.
    /// @param epoch        Epoch at the time of publication.
    /// @param index        Index of the attestation within the project's array.
    event AttestationPublished(
        bytes32 indexed projectHash,
        bytes32 indexed evaluationHash,
        string  filecoinCID,
        address indexed attester,
        uint64  epoch,
        uint256 index
    );

    /// @notice Emitted when the epoch is advanced.
    /// @param oldEpoch Previous epoch number.
    /// @param newEpoch New epoch number.
    /// @param advancer Address that triggered the advance.
    event EpochAdvanced(
        uint64 oldEpoch,
        uint64 newEpoch,
        address indexed advancer
    );

    /// @notice Emitted when an attester is authorized or deauthorized.
    event AttesterUpdated(address indexed attester, bool authorized);

    /// @notice Emitted when ownership is transferred.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ──────────────────────────────────────────────
    // Errors (custom errors save gas vs require strings)
    // ──────────────────────────────────────────────

    error OnlyOwner();
    error NotAuthorized();
    error EmptyCID();
    error ZeroEvaluationHash();
    error ZeroProjectHash();
    error ZeroAddress();
    error NoAttestations();
    error BatchLengthMismatch();

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

    /// @notice Deploy with epoch = 0 and the deployer as owner + authorized attester.
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
    /// @param projectHash     keccak256 of the project identifier string.
    /// @param evaluationHash  keccak256 of the full evidence JSON.
    /// @param filecoinCID     CID string of the evidence bundle on Filecoin.
    /// @return index The index of the new attestation in the project's array.
    function publishAttestation(
        bytes32 projectHash,
        bytes32 evaluationHash,
        string calldata filecoinCID
    ) external onlyAuthorized returns (uint256 index) {
        if (projectHash == bytes32(0)) revert ZeroProjectHash();
        if (evaluationHash == bytes32(0)) revert ZeroEvaluationHash();
        if (bytes(filecoinCID).length == 0) revert EmptyCID();

        Attestation memory att = Attestation({
            evaluationHash: evaluationHash,
            filecoinCID: filecoinCID,
            timestamp: uint64(block.timestamp),
            attester: msg.sender,
            epoch: currentEpoch
        });

        index = _attestations[projectHash].length;
        _attestations[projectHash].push(att);

        unchecked { totalAttestations++; }

        emit AttestationPublished(
            projectHash,
            evaluationHash,
            filecoinCID,
            msg.sender,
            currentEpoch,
            index
        );
    }

    // ──────────────────────────────────────────────
    // Attestation — batch (gas-optimized)
    // ──────────────────────────────────────────────

    /// @notice Publish multiple attestations in a single transaction.
    /// @dev    All arrays must have the same length. Uses the same epoch for
    ///         every attestation in the batch (reads currentEpoch once).
    /// @param projectHashes    Array of project hashes.
    /// @param evaluationHashes Array of evaluation hashes.
    /// @param filecoinCIDs     Array of Filecoin CID strings.
    function publishBatch(
        bytes32[] calldata projectHashes,
        bytes32[] calldata evaluationHashes,
        string[]  calldata filecoinCIDs
    ) external onlyAuthorized {
        uint256 len = projectHashes.length;
        if (len != evaluationHashes.length || len != filecoinCIDs.length)
            revert BatchLengthMismatch();

        // Cache epoch to avoid repeated SLOAD
        uint64 epoch = currentEpoch;
        uint64 ts = uint64(block.timestamp);
        address att = msg.sender;

        for (uint256 i; i < len; ) {
            bytes32 ph = projectHashes[i];
            bytes32 eh = evaluationHashes[i];
            string calldata cid = filecoinCIDs[i];

            if (ph == bytes32(0)) revert ZeroProjectHash();
            if (eh == bytes32(0)) revert ZeroEvaluationHash();
            if (bytes(cid).length == 0) revert EmptyCID();

            uint256 idx = _attestations[ph].length;
            _attestations[ph].push(
                Attestation({
                    evaluationHash: eh,
                    filecoinCID: cid,
                    timestamp: ts,
                    attester: att,
                    epoch: epoch
                })
            );

            emit AttestationPublished(ph, eh, cid, att, epoch, idx);

            unchecked { ++i; }
        }

        unchecked { totalAttestations += len; }
    }

    // ──────────────────────────────────────────────
    // Epoch management
    // ──────────────────────────────────────────────

    /// @notice Advance the epoch by 1. Owner-only.
    /// @return newEpoch The new epoch number.
    function advanceEpoch() external onlyOwner returns (uint64 newEpoch) {
        uint64 old = currentEpoch;
        unchecked { newEpoch = old + 1; }
        currentEpoch = newEpoch;
        emit EpochAdvanced(old, newEpoch, msg.sender);
    }

    // ──────────────────────────────────────────────
    // Attester management
    // ──────────────────────────────────────────────

    /// @notice Authorize or deauthorize an attester address. Owner-only.
    /// @param attester The address to update.
    /// @param authorized Whether the address should be authorized.
    function setAttester(address attester, bool authorized) external onlyOwner {
        if (attester == address(0)) revert ZeroAddress();
        authorizedAttesters[attester] = authorized;
        emit AttesterUpdated(attester, authorized);
    }

    // ──────────────────────────────────────────────
    // Ownership
    // ──────────────────────────────────────────────

    /// @notice Transfer ownership. Owner-only.
    /// @param newOwner The new owner address.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @notice Get the number of attestations for a project.
    /// @param projectHash keccak256 of the project identifier.
    /// @return count Number of attestations.
    function getAttestationCount(bytes32 projectHash)
        external
        view
        returns (uint256 count)
    {
        count = _attestations[projectHash].length;
    }

    /// @notice Get the latest attestation for a project.
    /// @param projectHash keccak256 of the project identifier.
    /// @return att The most recent Attestation struct.
    function getLatestAttestation(bytes32 projectHash)
        external
        view
        returns (Attestation memory att)
    {
        uint256 len = _attestations[projectHash].length;
        if (len == 0) revert NoAttestations();
        att = _attestations[projectHash][len - 1];
    }

    /// @notice Get a specific attestation by index.
    /// @param projectHash keccak256 of the project identifier.
    /// @param index The index in the project's attestation array.
    /// @return att The Attestation struct at that index.
    function getAttestation(bytes32 projectHash, uint256 index)
        external
        view
        returns (Attestation memory att)
    {
        att = _attestations[projectHash][index];
    }

    /// @notice Get all attestations for a project.
    /// @param projectHash keccak256 of the project identifier.
    /// @return atts Array of all Attestation structs for the project.
    function getAllAttestations(bytes32 projectHash)
        external
        view
        returns (Attestation[] memory atts)
    {
        atts = _attestations[projectHash];
    }
}
