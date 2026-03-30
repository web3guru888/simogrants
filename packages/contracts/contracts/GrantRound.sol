// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GrantRound
 * @notice Individual grant round contract deployed as a minimal proxy (EIP-1167).
 *         Handles applications, evaluation scoring, SQF allocations, and fund claiming.
 */
contract GrantRound is Ownable(msg.sender), ReentrancyGuard {
    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    enum RoundStatus {
        Accepting,    // 0 - accepting new applications
        Evaluating,   // 1 - scores being recorded
        Funded,       // 2 - allocations set, claims open
        Closed        // 3 - round finished
    }

    struct Application {
        address applicant;
        string  metadataURI;      // IPFS/R2 URI with project details + evidence
        bool    exists;
        uint256 appliedAt;
        uint256 score;            // Aggregated evaluation score (0-100 * 1e18)
        uint256 allocation;       // Allocated funding amount (in token wei / native wei)
        bool    funded;           // Whether funds have been claimed
    }

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    string public metadataURI;
    uint256 public applicationDeadline;
    uint256 public votingDeadline;
    RoundStatus public status;

    address public token;            // ERC20 token address or address(0) for native ETH
    uint256 public matchingPool;     // Total matching pool funded
    uint256 public allocatedTotal;   // Total allocated so far

    address public factory;          // Address of the GrantFactory that created this
    bool private _initialized;       // Reentrancy guard for initialize

    mapping(address => bool) public authorizedEvaluators;

    Application[] private _applications;
    mapping(address => uint256) private _applicantToId; // applicant => applicationId

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event Applied(address indexed applicant, uint256 indexed applicationId);
    event Evaluated(uint256 indexed applicationId, uint256 score);
    event Allocated(uint256 indexed applicationId, uint256 amount);
    event FundsClaimed(address indexed applicant, uint256 amount);
    event RoundStatusChanged(RoundStatus oldStatus, RoundStatus newStatus);
    event PoolFunded(address indexed funder, uint256 amount);
    event EvaluatorUpdated(address indexed evaluator, bool authorized);

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error RoundNotAccepting();
    error ApplicationDeadlinePassed();
    error AlreadyApplied();
    error NotAuthorizedEvaluator();
    error InvalidApplication();
    error NotApplicant();
    error NothingToClaim();
    error AlreadyFunded();
    error InvalidScore();
    error InvalidTransition();
    error ZeroAddress();

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier onlyAccepting() {
        if (status != RoundStatus.Accepting) revert RoundNotAccepting();
        if (block.timestamp > applicationDeadline) revert ApplicationDeadlinePassed();
        _;
    }

    modifier onlyFactoryOrOwner() {
        if (msg.sender != factory && msg.sender != owner()) revert NotAuthorizedEvaluator();
        _;
    }

    modifier onlyEvaluatorOrOwner() {
        if (!authorizedEvaluators[msg.sender] && msg.sender != owner() && msg.sender != factory) {
            revert NotAuthorizedEvaluator();
        }
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor (called via initialize for proxies)
    // ──────────────────────────────────────────────

    /// @dev Initialization function — called once by the factory after clone().
    function initialize(
        address _owner,
        address _factory,
        string calldata _metadataURI,
        uint256 _applicationDeadline,
        uint256 _votingDeadline,
        address _token
    ) external {
        if (_initialized) revert("Already initialized");
        _initialized = true;
        _transferOwnership(_owner);
        factory = _factory;
        metadataURI = _metadataURI;
        applicationDeadline = _applicationDeadline;
        votingDeadline = _votingDeadline;
        token = _token;
        status = RoundStatus.Accepting;
    }

    // ──────────────────────────────────────────────
    // Application
    // ──────────────────────────────────────────────

    /// @notice Apply to the grant round with a metadata URI.
    function submitApplication(string calldata _metadataURI) external onlyAccepting returns (uint256 applicationId) {
        if (_applicantToId[msg.sender] != 0) revert AlreadyApplied();
        if (bytes(_metadataURI).length == 0) revert InvalidApplication();

        applicationId = _applications.length;
        _applicantToId[msg.sender] = applicationId + 1; // 1-indexed to distinguish from 0

        _applications.push(Application({
            applicant: msg.sender,
            metadataURI: _metadataURI,
            exists: true,
            appliedAt: block.timestamp,
            score: 0,
            allocation: 0,
            funded: false
        }));

        emit Applied(msg.sender, applicationId);
    }

    // ──────────────────────────────────────────────
    // Evaluation
    // ──────────────────────────────────────────────

    /// @notice Record a single evaluation score for an application.
    /// @param applicationId The application index.
    /// @param score The aggregated score (0-100 * 1e18 for precision).
    function recordScore(uint256 applicationId, uint256 score) external onlyEvaluatorOrOwner {
        if (applicationId >= _applications.length) revert InvalidApplication();
        if (score > 100e18) revert InvalidScore();

        _applications[applicationId].score = score;
        emit Evaluated(applicationId, score);
    }

    /// @notice Record batch evaluation scores.
    function recordScores(
        uint256[] calldata applicationIds,
        uint256[] calldata scores
    ) external onlyEvaluatorOrOwner {
        if (applicationIds.length != scores.length) revert("Length mismatch");
        for (uint256 i; i < applicationIds.length; ) {
            uint256 id = applicationIds[i];
            uint256 s = scores[i];
            if (id >= _applications.length) revert InvalidApplication();
            if (s > 100e18) revert InvalidScore();
            _applications[id].score = s;
            emit Evaluated(id, s);
            unchecked { ++i; }
        }
    }

    // ──────────────────────────────────────────────
    // Allocation
    // ──────────────────────────────────────────────

    /// @notice Set SQF allocation for an application. Owner only.
    function setAllocation(uint256 applicationId, uint256 amount) external onlyOwner {
        if (applicationId >= _applications.length) revert InvalidApplication();
        _applications[applicationId].allocation = amount;
        emit Allocated(applicationId, amount);
    }

    /// @notice Set batch allocations.
    function setAllocations(
        uint256[] calldata applicationIds,
        uint256[] calldata amounts
    ) external onlyOwner {
        if (applicationIds.length != amounts.length) revert("Length mismatch");
        for (uint256 i; i < applicationIds.length; ) {
            uint256 id = applicationIds[i];
            if (id >= _applications.length) revert InvalidApplication();
            _applications[id].allocation = amounts[i];
            emit Allocated(id, amounts[i]);
            unchecked { ++i; }
        }
    }

    // ──────────────────────────────────────────────
    // Fund claiming
    // ──────────────────────────────────────────────

    /// @notice Claim allocated funds for an application.
    function claimFunds(uint256 applicationId) external nonReentrant {
        if (applicationId >= _applications.length) revert InvalidApplication();
        Application storage app = _applications[applicationId];
        if (app.applicant != msg.sender) revert NotApplicant();
        if (app.allocation == 0) revert NothingToClaim();
        if (app.funded) revert AlreadyFunded();
        if (status != RoundStatus.Funded) revert RoundNotAccepting();

        app.funded = true;
        uint256 amount = app.allocation;
        allocatedTotal += amount;

        if (token == address(0)) {
            // Native ETH
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            // ERC20 token (e.g., USDC, USDT)
            bool success = IERC20(token).transfer(msg.sender, amount);
            require(success, "Transfer failed");
        }

        emit FundsClaimed(msg.sender, amount);
    }

    // ──────────────────────────────────────────────
    // Pool funding
    // ──────────────────────────────────────────────

    /// @notice Fund the matching pool with native ETH.
    function fundPool() external payable {
        matchingPool += msg.value;
        emit PoolFunded(msg.sender, msg.value);
    }

    /// @notice Fund the matching pool with ERC20 tokens.
    function fundPoolToken(uint256 amount) external {
        if (token == address(0)) revert("Native ETH round");
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        matchingPool += amount;
        emit PoolFunded(msg.sender, amount);
    }

    // ──────────────────────────────────────────────
    // Status management
    // ──────────────────────────────────────────────

    /// @notice Advance round to Evaluating status.
    function startEvaluation() external onlyFactoryOrOwner {
        if (status != RoundStatus.Accepting) revert InvalidTransition();
        RoundStatus old = status;
        status = RoundStatus.Evaluating;
        emit RoundStatusChanged(old, status);
    }

    /// @notice Advance round to Funded status (allocations set, claims open).
    function markFunded() external onlyFactoryOrOwner {
        if (status != RoundStatus.Evaluating) revert InvalidTransition();
        RoundStatus old = status;
        status = RoundStatus.Funded;
        emit RoundStatusChanged(old, status);
    }

    /// @notice Close the round.
    function closeRound() external onlyOwner {
        RoundStatus old = status;
        status = RoundStatus.Closed;
        emit RoundStatusChanged(old, status);
    }

    /// @notice Set an authorized evaluator.
    function setEvaluator(address evaluator, bool authorized) external onlyOwner {
        if (evaluator == address(0)) revert ZeroAddress();
        authorizedEvaluators[evaluator] = authorized;
        emit EvaluatorUpdated(evaluator, authorized);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    function getApplication(uint256 applicationId) external view returns (Application memory) {
        require(applicationId < _applications.length, "Invalid ID");
        return _applications[applicationId];
    }

    function getApplicationCount() external view returns (uint256) {
        return _applications.length;
    }

    function getApplicationId(address applicant) external view returns (uint256) {
        uint256 id = _applicantToId[applicant];
        if (id == 0) return type(uint256).max;
        return id - 1;
    }

    function getStatus() external view returns (RoundStatus) {
        return status;
    }

    /// @notice Get all application IDs (useful for off-chain indexing).
    function getAllApplicationIds() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](_applications.length);
        for (uint256 i; i < _applications.length; ) {
            ids[i] = i;
            unchecked { ++i; }
        }
        return ids;
    }

    /// @notice Allow receiving native ETH.
    receive() external payable {}
}
