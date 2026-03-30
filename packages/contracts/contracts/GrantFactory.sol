// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./GrantRound.sol";

/**
 * @title GrantFactory
 * @notice Creates and tracks GrantRound contracts via EIP-1167 minimal proxy pattern.
 *         Entry point for the SIMOGRANTS on-chain layer.
 */
contract GrantFactory is Ownable {
    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    address public implementation;   // GrantRound implementation contract
    address[] public rounds;         // All created round addresses
    mapping(address => bool) public isRound; // Quick lookup for valid rounds

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event RoundCreated(
        address indexed roundAddress,
        address indexed creator,
        uint256 matchingPool,
        address token,
        uint256 applicationDeadline
    );
    event ImplementationUpdated(address oldImplementation, address newImplementation);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error ZeroAddress();
    error InvalidDeadline();

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor(address _implementation) Ownable(msg.sender) {
        if (_implementation == address(0)) revert ZeroAddress();
        implementation = _implementation;
    }

    // ──────────────────────────────────────────────
    // Round creation
    // ──────────────────────────────────────────────

    /// @notice Create a new GrantRound via minimal proxy.
    /// @param _metadataURI IPFS URI with round details JSON.
    /// @param _matchingPool Total matching pool amount (informational).
    /// @param _token Funding token (USDC, USDT, or address(0) for ETH).
    /// @param _applicationDeadline Unix timestamp for application cutoff.
    /// @param _votingDeadline Unix timestamp for voting/evaluation cutoff.
    /// @return roundAddress The address of the newly created GrantRound proxy.
    function createRound(
        string calldata _metadataURI,
        uint256 _matchingPool,
        address _token,
        uint256 _applicationDeadline,
        uint256 _votingDeadline
    ) external returns (address roundAddress) {
        if (_applicationDeadline <= block.timestamp) revert InvalidDeadline();

        // Clone the implementation
        address clone = Clones.clone(implementation);
        roundAddress = clone;
        isRound[clone] = true;
        rounds.push(clone);

        // Initialize the cloned contract
        GrantRound(payable(clone)).initialize(
            msg.sender,       // owner = round creator
            address(this),    // factory = this contract
            _metadataURI,
            _applicationDeadline,
            _votingDeadline,
            _token
        );

        emit RoundCreated(
            roundAddress,
            msg.sender,
            _matchingPool,
            _token,
            _applicationDeadline
        );
    }

    // ──────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────

    /// @notice Update the GrantRound implementation (for upgrades).
    function setImplementation(address _implementation) external onlyOwner {
        if (_implementation == address(0)) revert ZeroAddress();
        address old = implementation;
        implementation = _implementation;
        emit ImplementationUpdated(old, _implementation);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @notice Get total number of rounds created.
    function roundCount() external view returns (uint256) {
        return rounds.length;
    }

    /// @notice Get round address by index.
    function getRound(uint256 index) external view returns (address) {
        require(index < rounds.length, "Invalid index");
        return rounds[index];
    }

    /// @notice Get all round addresses.
    function getAllRounds() external view returns (address[] memory) {
        return rounds;
    }
}
