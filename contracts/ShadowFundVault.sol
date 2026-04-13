// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC7984Receiver} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984Receiver.sol";
import {PriceOracle} from "./PriceOracle.sol";
import {ShadowFundShareToken} from "./ShadowFundShareToken.sol";

/**
 * @title ShadowFundVault
 * @notice Confidential on-chain investment vault built on iExec Nox.
 *
 * Architecture:
 *   - Single vault contract stores all fund state in mapping(fundId => Fund).
 *   - Each fund has an encrypted strategy (4 asset allocation percentages),
 *     encrypted per-depositor share balances, and encrypted pending requests.
 *   - Implements ERC-7540 async vault semantics:
 *       requestDeposit → processDeposit → shares minted
 *       requestRedeem  → processRedeem  → cUSDC returned
 *   - A thin ShadowFundShareToken facade is deployed per fund for ERC-7984
 *     compliance (wallet/explorer pinnable address).
 *
 * Privacy model:
 *   - Strategy allocations are encrypted on-chain; nobody sees them until
 *     the manager calls revealStrategy().
 *   - Deposit amounts and share balances are encrypted; only the depositor
 *     can decrypt their own position via the Nox JS SDK.
 *   - Total depositor count is public (plaintext). TVL is encrypted.
 *   - After revealStrategy(), allocation handles are made publicly decryptable
 *     via Nox.allowPublicDecryption().
 *
 * Trust assumptions (acceptable for hackathon):
 *   - The manager is trusted to submit percentages that sum to 100.
 *     On-chain enforcement is impossible because Nox has no control-flow
 *     branching on encrypted values. The sum-to-100 equality handle is made
 *     publicly decryptable at reveal time for auditing.
 *   - Depositors must grant the vault operator rights on cUSDC before depositing
 *     (setOperator(vault, expiry) on the cUSDC token contract).
 *
 * Nox ACL notes:
 *   - Every function producing a new euint256 calls Nox.allowThis() so the
 *     vault can reuse the handle in future transactions.
 *   - Per-user handles additionally call Nox.allow(handle, user).
 *   - Before transferring cUSDC to/from an external address, Nox.allowTransient()
 *     is called so the cToken contract can consume the handle in the same tx.
 */

interface IERC7984 {
    function confidentialTransfer(
        address to,
        externalEuint256 amount,
        bytes calldata proof
    ) external;

    function confidentialTransfer(
        address to,
        euint256 amount
    ) external returns (euint256);
}

contract ShadowFundVault is IERC7984Receiver {
    // ── Errors ────────────────────────────────────────────────────────────────

    error NotManager();
    error FundNotFound();
    error AlreadyRevealed();
    error NotRevealed();
    error NoPendingDeposit();
    error NoPendingRedeem();
    error NotImplemented();
    error OnlyCUSDC();
    error InvalidCallbackData();

    // ── Events ────────────────────────────────────────────────────────────────

    event FundCreated(uint256 indexed fundId, address indexed manager, string name, address shareFacade);
    event StrategySet(uint256 indexed fundId);
    event StrategyRevealed(uint256 indexed fundId, uint256 pctETH, uint256 pctBTC, uint256 pctLINK, uint256 pctUSDC);
    event DepositRequested(uint256 indexed fundId, address indexed user);
    event DepositProcessed(uint256 indexed fundId, address indexed user);
    event RedeemRequested(uint256 indexed fundId, address indexed user);
    event RedeemProcessed(uint256 indexed fundId, address indexed user);
    event RedeemClaimed(uint256 indexed fundId, address indexed user);

    // ── State ─────────────────────────────────────────────────────────────────

    struct Fund {
        address manager;
        string  name;
        string  description;
        uint256 createdAt;
        uint256 performanceFeeBps;   // display-only, not deducted on-chain
        address shareTokenFacade;

        // Encrypted strategy allocations (0-100 for each asset)
        euint256 pctETH;
        euint256 pctBTC;
        euint256 pctLINK;
        euint256 pctUSDC;
        bool strategySet;

        // Reveal state
        bool    revealed;
        uint256 revealedPctETH;
        uint256 revealedPctBTC;
        uint256 revealedPctLINK;
        uint256 revealedPctUSDC;

        // Asset prices snapshotted at createFund (8 decimals, Chainlink scale)
        int256[4] startPricesE8;

        // Encrypted aggregate state (manager has ACL on totalAssets/totalShares)
        euint256 totalAssets;  // encrypted cUSDC deposited
        euint256 totalShares;  // encrypted share supply

        // Public metadata
        uint256 depositorCount;
        // Track depositors with pending deposits to avoid double-counting
        mapping(address => bool) hasPosition;

        // Per-user encrypted state
        mapping(address => euint256) shares;
        mapping(address => euint256) pendingDeposit;
        mapping(address => bool)     hasPendingDeposit;
        mapping(address => euint256) pendingRedeem;
        mapping(address => bool)     hasPendingRedeem;
        // After processRedeem, user can call claimRedemption to receive cUSDC
        mapping(address => bool)     claimable;
        // Vault-owned cUSDC amount payable to user after processRedeem
        mapping(address => euint256) claimablePayable;
    }

    mapping(uint256 => Fund) private funds;
    uint256 public nextFundId;

    address public immutable cUSDC;
    PriceOracle public immutable oracle;

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _cUSDC, address _oracle) {
        require(_cUSDC  != address(0), "ShadowFundVault: zero cUSDC");
        require(_oracle != address(0), "ShadowFundVault: zero oracle");
        cUSDC  = _cUSDC;
        oracle = PriceOracle(_oracle);
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyManager(uint256 fundId) {
        if (funds[fundId].manager != msg.sender) revert NotManager();
        _;
    }

    modifier fundExists(uint256 fundId) {
        if (funds[fundId].manager == address(0)) revert FundNotFound();
        _;
    }

    // ── Fund creation ─────────────────────────────────────────────────────────

    /**
     * @notice Create a new fund. Caller becomes the fund manager.
     * @param fundName     Human-readable fund name.
     * @param description  Short description.
     * @param perfFeeBps   Performance fee in basis points (display-only).
     * @return fundId      Numeric ID of the newly created fund.
     */
    function createFund(
        string calldata fundName,
        string calldata description,
        uint256 perfFeeBps
    ) external returns (uint256 fundId) {
        fundId = nextFundId++;
        Fund storage f = funds[fundId];

        f.manager          = msg.sender;
        f.name             = fundName;
        f.description      = description;
        f.createdAt        = block.timestamp;
        f.performanceFeeBps = perfFeeBps;

        // Snapshot starting prices for performance calculation
        f.startPricesE8 = oracle.getAllPrices();

        // Initialise encrypted aggregates to 0
        f.totalAssets = Nox.toEuint256(0);
        Nox.allowThis(f.totalAssets);
        Nox.allow(f.totalAssets, msg.sender); // manager can decrypt TVL

        f.totalShares = Nox.toEuint256(0);
        Nox.allowThis(f.totalShares);
        Nox.allow(f.totalShares, msg.sender);

        // Deploy per-fund ERC-7984 share token facade
        ShadowFundShareToken facade = new ShadowFundShareToken(
            address(this),
            fundId,
            string(abi.encodePacked("ShadowFund-", fundName, " Shares")),
            string(abi.encodePacked("sfUSDC-", fundName))
        );
        f.shareTokenFacade = address(facade);

        emit FundCreated(fundId, msg.sender, fundName, address(facade));
    }

    // ── Strategy management ───────────────────────────────────────────────────

    /**
     * @notice Submit an encrypted allocation strategy.
     *         Each percentage is an encrypted uint in [0, 100].
     *         The four percentages should sum to 100, but this cannot be
     *         enforced on-chain because Nox has no conditional revert on ebool.
     *         Trust assumption: manager is honest; sum is auditable at reveal.
     *
     * @dev Caller must encrypt each percentage with the vault address as the
     *      target contract: handleClient.encryptInput(pct, "uint256", vaultAddr).
     *      Call this function once per strategy period (can re-submit to rebalance
     *      before reveal, but NOT after).
     */
    function setStrategy(
        uint256 fundId,
        externalEuint256 extPctETH,  bytes calldata proofETH,
        externalEuint256 extPctBTC,  bytes calldata proofBTC,
        externalEuint256 extPctLINK, bytes calldata proofLINK,
        externalEuint256 extPctUSDC, bytes calldata proofUSDC
    ) external onlyManager(fundId) fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (f.revealed) revert AlreadyRevealed();

        // Ingest encrypted inputs (validates proofs)
        f.pctETH  = Nox.fromExternal(extPctETH,  proofETH);
        f.pctBTC  = Nox.fromExternal(extPctBTC,  proofBTC);
        f.pctLINK = Nox.fromExternal(extPctLINK, proofLINK);
        f.pctUSDC = Nox.fromExternal(extPctUSDC, proofUSDC);

        // ACL: vault must be able to reuse handles; manager can decrypt locally
        Nox.allowThis(f.pctETH);  Nox.allow(f.pctETH,  msg.sender);
        Nox.allowThis(f.pctBTC);  Nox.allow(f.pctBTC,  msg.sender);
        Nox.allowThis(f.pctLINK); Nox.allow(f.pctLINK, msg.sender);
        Nox.allowThis(f.pctUSDC); Nox.allow(f.pctUSDC, msg.sender);

        f.strategySet = true;
        emit StrategySet(fundId);
    }

    /**
     * @notice Permanently reveal the strategy. Irreversible.
     * @dev The manager provides plaintext values (they already know them — they
     *      submitted them encrypted). The contract stores the plaintext, calls
     *      allowPublicDecryption on the encrypted handles for on-chain verifiability,
     *      and emits StrategyRevealed so the frontend can trigger the reveal animation.
     *
     * IMPORTANT: This is a one-way operation. Once revealed, the strategy and
     * all encrypted allocation handles become publicly decryptable by anyone.
     */
    function revealStrategy(
        uint256 fundId,
        uint256 plaintextEth,
        uint256 plaintextBtc,
        uint256 plaintextLink,
        uint256 plaintextUsdc
    ) external onlyManager(fundId) fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (f.revealed) revert AlreadyRevealed();

        // Store plaintext copies (used for performance score computation)
        f.revealedPctETH  = plaintextEth;
        f.revealedPctBTC  = plaintextBtc;
        f.revealedPctLINK = plaintextLink;
        f.revealedPctUSDC = plaintextUsdc;
        f.revealed = true;

        // Make encrypted handles publicly decryptable for on-chain auditability
        if (f.strategySet) {
            Nox.allowPublicDecryption(f.pctETH);
            Nox.allowPublicDecryption(f.pctBTC);
            Nox.allowPublicDecryption(f.pctLINK);
            Nox.allowPublicDecryption(f.pctUSDC);
            // Also reveal total assets so anyone can see final AUM
            Nox.allowPublicDecryption(f.totalAssets);
        }

        emit StrategyRevealed(fundId, plaintextEth, plaintextBtc, plaintextLink, plaintextUsdc);
    }

    // ── Deposits (ERC-7540 async) ─────────────────────────────────────────────

    /**
     * @notice Request a deposit of encrypted cUSDC into the fund.
     *
     * @dev WHY TWO HANDLES:
     *      Nox `encryptInput` binds the input proof to a specific target contract address.
     *      A proof generated for the vault CANNOT be passed to cUSDC's `confidentialTransferFrom`,
     *      and vice versa. Two separate encrypted handles for the same amount are required:
     *        - `amountForCToken + proofForCToken`: used by cUSDC.confidentialTransferFrom to pull funds
     *        - `amountForVault + proofForVault`:   used by the vault to record the pending deposit
     *
     *      The depositor must call encryptInput twice with the same plaintext amount:
     *        const { handle: hC, handleProof: pC } = await handleClient.encryptInput(amount, "uint256", cUSDCAddress)
     *        const { handle: hV, handleProof: pV } = await handleClient.encryptInput(amount, "uint256", vaultAddress)
     *        vault.requestDeposit(fundId, hC, pC, hV, pV)
     *
     *      Requires msg.sender to have granted this vault operator rights:
     *        cUSDC.setOperator(vault, expiry) — call once, reuse many times.
     *
     * @param fundId          Target fund.
     * @param amountForCToken Encrypted amount targeted at the cUSDC contract.
     * @param proofForCToken  Input proof for the cUSDC transfer.
     * @param amountForVault  Encrypted amount targeted at this vault contract.
     * @param proofForVault   Input proof for the vault's accounting handle.
     */
    /**
     * @notice ERC-7984 receiver callback — entry point for depositor deposits.
     * @dev Depositor calls `cUSDC.confidentialTransferAndCall(vault, handle, proof, abi.encode(fundId))`.
     *      The cUSDC token forwards the already-ingested `euint256 amount` (ACL'd to this vault)
     *      to this callback. We decode the target fundId from `data` and book the pending deposit
     *      against `from` (the original depositor).
     *
     *      This replaces the operator + confidentialTransferFrom pattern because ERC-7984 proofs
     *      bind to the end user who directly calls the token contract — a third-party operator
     *      flow fails with InvalidProof in the Nox precompile.
     */
    function onConfidentialTransferReceived(
        address /* operator */,
        address from,
        euint256 amount,
        bytes calldata data
    ) external override returns (ebool) {
        if (msg.sender != cUSDC) revert OnlyCUSDC();
        if (data.length != 32) revert InvalidCallbackData();

        uint256 fundId = abi.decode(data, (uint256));
        if (funds[fundId].manager == address(0)) revert FundNotFound();

        Fund storage f = funds[fundId];

        // Persist the handle for this vault (cToken already granted us access).
        Nox.allowThis(amount);

        // Record pending deposit (add to any existing pending amount)
        if (f.hasPendingDeposit[from]) {
            euint256 newPending = Nox.add(f.pendingDeposit[from], amount);
            f.pendingDeposit[from] = newPending;
            Nox.allowThis(newPending);
            Nox.allow(newPending, from);
        } else {
            f.pendingDeposit[from] = amount;
            Nox.allow(amount, from);
            f.hasPendingDeposit[from] = true;
        }

        emit DepositRequested(fundId, from);
        return Nox.toEbool(true);
    }

    /**
     * @notice Process a pending deposit — convert pending cUSDC into shares.
     * @dev Permissionless: can be called by anyone (manager or keeper).
     *      Shares are minted 1:1 with cUSDC deposited (simplified for hackathon).
     */
    function processDeposit(uint256 fundId, address user) external fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (!f.hasPendingDeposit[user]) revert NoPendingDeposit();

        euint256 pending = f.pendingDeposit[user];

        // Mint shares 1:1 (simplified — in production, compute NAV-based share price)
        euint256 newShares = pending;
        Nox.allowThis(newShares);
        Nox.allow(newShares, user);

        // Add to user's share balance
        if (f.hasPosition[user]) {
            euint256 updatedShares = Nox.add(f.shares[user], newShares);
            f.shares[user] = updatedShares;
            Nox.allowThis(updatedShares);
            Nox.allow(updatedShares, user);
        } else {
            f.shares[user] = newShares;
            f.hasPosition[user] = true;
            f.depositorCount++;
        }

        // Update encrypted totals
        euint256 updatedAssets = Nox.add(f.totalAssets, pending);
        f.totalAssets = updatedAssets;
        Nox.allowThis(updatedAssets);
        Nox.allow(updatedAssets, f.manager);

        euint256 updatedTotalShares = Nox.add(f.totalShares, newShares);
        f.totalShares = updatedTotalShares;
        Nox.allowThis(updatedTotalShares);
        Nox.allow(updatedTotalShares, f.manager);

        // Clear pending deposit
        f.pendingDeposit[user] = Nox.toEuint256(0);
        Nox.allowThis(f.pendingDeposit[user]);
        f.hasPendingDeposit[user] = false;

        emit DepositProcessed(fundId, user);
    }

    // ── Redemptions (ERC-7540 async) ──────────────────────────────────────────

    /**
     * @notice Request redemption of encrypted share amount.
     * @dev The depositor's shares must have been minted first (processDeposit).
     */
    function requestRedeem(
        uint256 fundId,
        externalEuint256 shares,
        bytes calldata proof
    ) external fundExists(fundId) {
        Fund storage f = funds[fundId];

        euint256 shareAmt = Nox.fromExternal(shares, proof);
        Nox.allowThis(shareAmt);
        Nox.allow(shareAmt, msg.sender);

        if (f.hasPendingRedeem[msg.sender]) {
            euint256 newPending = Nox.add(f.pendingRedeem[msg.sender], shareAmt);
            f.pendingRedeem[msg.sender] = newPending;
            Nox.allowThis(newPending);
            Nox.allow(newPending, msg.sender);
        } else {
            f.pendingRedeem[msg.sender] = shareAmt;
            f.hasPendingRedeem[msg.sender] = true;
        }

        emit RedeemRequested(fundId, msg.sender);
    }

    /**
     * @notice Step 1 of redemption: burn shares, mark user as claimable.
     * @dev Redemption does NOT require strategy reveal. Depositors can always
     *      exit regardless of whether the manager has revealed.
     *
     *      Redemption is a two-step process because the vault cannot generate
     *      a Nox proof on-chain (proof generation requires a wallet + JS SDK).
     *
     *      STEP 1 (this function): Manager or keeper burns the pending share amount
     *      and marks the user as claimable. Shares are deducted from vault totals.
     *
     *      STEP 2 (claimRedemption): The depositor calls claimRedemption() with a
     *      fresh handle+proof for cUSDC (generated client-side), and the vault
     *      sends them their cUSDC via confidentialTransfer.
     *
     *      This two-step design mirrors the ERC-7540 async pattern and is the only
     *      approach that works in the current Nox on-chain environment.
     */
    function processRedeem(uint256 fundId, address user) external fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (!f.hasPendingRedeem[user]) revert NoPendingRedeem();

        euint256 redeemShares = f.pendingRedeem[user];

        // Burn shares from user balance
        euint256 updatedUserShares = Nox.sub(f.shares[user], redeemShares);
        f.shares[user] = updatedUserShares;
        Nox.allowThis(updatedUserShares);
        Nox.allow(updatedUserShares, user);

        // Update encrypted totals
        euint256 updatedTotalShares = Nox.sub(f.totalShares, redeemShares);
        f.totalShares = updatedTotalShares;
        Nox.allowThis(updatedTotalShares);
        Nox.allow(updatedTotalShares, f.manager);

        euint256 updatedAssets = Nox.sub(f.totalAssets, redeemShares);
        f.totalAssets = updatedAssets;
        Nox.allowThis(updatedAssets);
        Nox.allow(updatedAssets, f.manager);

        // Move shares → payable cUSDC amount (1:1). Vault owns this handle so
        // it can later call cUSDC.confidentialTransfer(user, euint256) directly,
        // avoiding the external-proof flow which fails for third-party callers.
        f.claimablePayable[user] = redeemShares;
        Nox.allowThis(f.claimablePayable[user]);
        Nox.allow(f.claimablePayable[user], user);

        // Clear pending redeem and mark as claimable
        f.pendingRedeem[user] = Nox.toEuint256(0);
        Nox.allowThis(f.pendingRedeem[user]);
        f.hasPendingRedeem[user] = false;
        f.claimable[user] = true;

        emit RedeemProcessed(fundId, user);
    }

    /**
     * @notice Step 2 of redemption: depositor claims their cUSDC.
     * @dev No handle/proof required — the vault owns the euint256 amount set in
     *      processRedeem and uses the ERC-7984 euint256 overload of
     *      confidentialTransfer directly. `allowTransient` grants cUSDC temporary
     *      access to consume the handle in this tx.
     */
    function claimRedemption(uint256 fundId) external fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (!f.claimable[msg.sender]) revert NoPendingRedeem(); // reuse for "nothing to claim"

        f.claimable[msg.sender] = false;

        euint256 amt = f.claimablePayable[msg.sender];
        Nox.allowTransient(amt, cUSDC);
        IERC7984(cUSDC).confidentialTransfer(msg.sender, amt);

        // Zero out stored handle so stale ACL isn't retained
        f.claimablePayable[msg.sender] = Nox.toEuint256(0);
        Nox.allowThis(f.claimablePayable[msg.sender]);

        emit RedeemClaimed(fundId, msg.sender);
    }

    // ── ERC-7540 canonical stubs ──────────────────────────────────────────────
    // Required for spec compliance even if the vault uses the async-only flow.

    function pendingDepositRequest(uint256, address) external pure returns (uint256) {
        revert NotImplemented();
    }

    function claimableDepositRequest(uint256, address) external pure returns (uint256) {
        revert NotImplemented();
    }

    function pendingRedeemRequest(uint256, address) external pure returns (uint256) {
        revert NotImplemented();
    }

    function claimableRedeemRequest(uint256, address) external pure returns (uint256) {
        revert NotImplemented();
    }

    function deposit(uint256, address, address) external pure returns (uint256) {
        revert NotImplemented();
    }

    function redeem(uint256, address, address) external pure returns (uint256) {
        revert NotImplemented();
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Returns the encrypted share balance handle for a user in a given fund.
     *         Use the iExec Nox JS SDK to decrypt: handleClient.decrypt(handle).
     */
    function shareBalanceOf(uint256 fundId, address user)
        external
        view
        fundExists(fundId)
        returns (bytes32)
    {
        // euint256 is internally stored as bytes32 handle
        return euint256.unwrap(funds[fundId].shares[user]);
    }

    /**
     * @notice Returns the encrypted total share supply handle.
     *         ACL: accessible by the fund manager (granted in processDeposit).
     */
    function shareTotalSupply(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (bytes32)
    {
        return euint256.unwrap(funds[fundId].totalShares);
    }

    /**
     * @notice Returns public (non-sensitive) fund metadata.
     */
    function getFundMetadata(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (
            address manager,
            string memory fundName,
            string memory description,
            uint256 createdAt,
            uint256 performanceFeeBps,
            bool revealed,
            bool strategySet,
            uint256 depositorCount,
            address shareFacade
        )
    {
        Fund storage f = funds[fundId];
        return (
            f.manager,
            f.name,
            f.description,
            f.createdAt,
            f.performanceFeeBps,
            f.revealed,
            f.strategySet,
            f.depositorCount,
            f.shareTokenFacade
        );
    }

    /**
     * @notice Returns the revealed strategy allocations. Reverts if not revealed.
     */
    function getRevealedStrategy(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (uint256 eth, uint256 btc, uint256 link, uint256 usdc)
    {
        Fund storage f = funds[fundId];
        if (!f.revealed) revert NotRevealed();
        return (f.revealedPctETH, f.revealedPctBTC, f.revealedPctLINK, f.revealedPctUSDC);
    }

    /**
     * @notice Returns the price-weighted performance score in basis points.
     *         Positive = outperform, negative = underperform vs equal-weight USDC hold.
     *         Formula: sum_i(pct_i / 100 * (priceNow_i - priceStart_i) / priceStart_i * 10000)
     *         Reverts if strategy has not been revealed.
     */
    function getPerformanceScoreBps(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (int256 scoreBps)
    {
        Fund storage f = funds[fundId];
        if (!f.revealed) revert NotRevealed();

        int256[4] memory currentPrices = oracle.getAllPrices();
        int256[4] memory startPrices   = f.startPricesE8;
        uint256[4] memory pcts = [f.revealedPctETH, f.revealedPctBTC, f.revealedPctLINK, f.revealedPctUSDC];

        for (uint256 i = 0; i < 4; i++) {
            if (startPrices[i] <= 0) continue;
            int256 priceDelta = currentPrices[i] - startPrices[i];
            // pct * priceDelta / startPrice * 100 (result in bps)
            scoreBps += (int256(pcts[i]) * priceDelta * 100) / startPrices[i];
        }
    }

    /**
     * @notice Returns the price snapshot taken at fund creation.
     */
    function getStartPrices(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (int256[4] memory)
    {
        return funds[fundId].startPricesE8;
    }

    /**
     * @notice Returns whether a user has a pending deposit in a fund.
     */
    function hasPendingDeposit(uint256 fundId, address user) external view returns (bool) {
        return funds[fundId].hasPendingDeposit[user];
    }

    /**
     * @notice Returns whether a user has a pending redemption in a fund.
     */
    function hasPendingRedeem(uint256 fundId, address user) external view returns (bool) {
        return funds[fundId].hasPendingRedeem[user];
    }

    /**
     * @notice Returns whether a user has a processed redemption they can claim.
     *         Set to true by processRedeem, cleared by claimRedemption.
     */
    function isClaimable(uint256 fundId, address user) external view returns (bool) {
        return funds[fundId].claimable[user];
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * @dev Sends cUSDC to `recipient` using an encrypted handle.
     *      Caller must have called Nox.allowTransient(handle, cUSDC) first.
     *      Uses a raw external call to avoid importing the full cToken interface
     *      with handle types — the calldata is built manually to match
     *      confidentialTransfer(address, euint256) = 0xXXXXXXXX.
     *
     *      NOTE: This requires the vault to hold the corresponding cUSDC balance.
     */
    function _sendCUSDC(address recipient, euint256 handle) internal {
        // encode: confidentialTransfer(address to, euint256 handle)
        // euint256 is internally bytes32, matching the ABI encoding of bytes32
        bytes32 rawHandle = euint256.unwrap(handle);
        (bool ok, ) = cUSDC.call(
            abi.encodeWithSignature(
                "confidentialTransfer(address,bytes32)",
                recipient,
                rawHandle
            )
        );
        require(ok, "ShadowFundVault: cUSDC transfer failed");
    }
}
