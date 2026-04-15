// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC7984Receiver} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984Receiver.sol";
import {PriceOracle} from "./PriceOracle.sol";
import {ShadowFundShareToken} from "./ShadowFundShareToken.sol";
import {IAavePool, IERC20Min} from "./IAavePool.sol";
import {AaveAddresses} from "./AaveAddresses.sol";

/**
 * @title ShadowFundVault
 * @notice Confidential investment vault with real Aave v3 yield.
 *
 * Architecture:
 *   - Single vault contract; multi-fund state in mapping(fundId => Fund).
 *   - Each fund has an encrypted strategy (single `encryptedWethBps` — manager's
 *     claim about WETH vs USDC allocation in basis points), encrypted per-depositor
 *     share balances, encrypted pending requests.
 *   - Deposits are auto-minted inside the ERC-7984 receiver callback (no manager
 *     action required). Shares are minted 1:1 with the deposited cUSDC amount —
 *     simplification accepted for hackathon; redeem uses proper ERC-4626 math so
 *     Aave yield still flows to existing holders.
 *   - Redeem is hybrid: when `fundPrincipal == 0` the redeem settles atomically
 *     inside `requestRedeem` (vault holds enough liquid cUSDC). When
 *     `fundPrincipal > 0` (capital supplied to Aave) the redeem falls back to the
 *     ERC-7540 async path — manager calls `processRedeem` after pulling enough
 *     liquidity back from Aave, then user calls `claimRedemption`.
 *
 * Real Aave v3 yield:
 *   - 100% of productive capital is supplied as plaintext USDC to Aave's USDC reserve.
 *     The `encryptedWethBps` is a *virtual* allocation — revealed at period end and
 *     used for an "allocation alpha vs 50/50 benchmark" score.
 *   - Supply flow (2 txs, manager-driven):
 *       1. initiateSupply(fundId, amount)
 *            → trivially-encrypts amount, calls cUSDC.unwrap(vault, vault, euint256).
 *              Burns vault's encrypted cUSDC, creates a pending unwrap request.
 *       2. off-chain: manager calls handleClient.publicDecrypt(handle) to get proof.
 *       3. finalizeSupply(fundId, decryptionProof)
 *            → cUSDC.finalizeUnwrap transfers plaintext USDC to vault,
 *              vault approves + Aave.supply. fundPrincipal += amount.
 *   - Withdraw flow (1 tx): Aave.withdraw → cUSDC.wrap → encrypted balance inflates
 *     by (principal + realized yield). Depositors benefit proportionally because
 *     their share count is unchanged but totalAssets grew.
 *   - Multi-fund yield attribution: proportional by `fundPrincipal / totalPrincipalSum`.
 *     Simplified for hackathon; imprecise with non-simultaneous supplies.
 *
 * Privacy model:
 *   - Strategy (wethBps) encrypted on-chain; revealed one-way via revealStrategy().
 *   - Individual share balances encrypted; only depositor can decrypt via Nox SDK.
 *   - `depositorCount` is plaintext. `fundPrincipal` is plaintext (Aave leg is public).
 *   - Encrypted `totalAssets` can be decrypted by the manager only.
 */

interface ICUSDC {
    function confidentialTransfer(
        address to,
        euint256 amount
    ) external returns (euint256);

    // euint256 overload — no external proof; handle must already be ACL'd to msg.sender
    function unwrap(
        address from,
        address to,
        euint256 amount
    ) external returns (euint256);

    function finalizeUnwrap(
        euint256 unwrapRequestId,
        bytes calldata decryptedAmountAndProof
    ) external;

    function wrap(address to, uint256 amount) external returns (euint256);
}

contract ShadowFundVault is IERC7984Receiver {
    // ── Errors ────────────────────────────────────────────────────────────────

    error NotManager();
    error FundNotFound();
    error AlreadyRevealed();
    error NotRevealed();
    error NoPendingRedeem();
    error NotImplemented();
    error OnlyCUSDC();
    error InvalidCallbackData();
    error InvalidWethBps();
    error ZeroAmount();
    error SupplyAlreadyPending();
    error NoPendingSupply();
    error InsufficientFundAValue();
    error AaveSupplyFailed();
    error AaveWithdrawFailed();

    // ── Events ────────────────────────────────────────────────────────────────

    event FundCreated(uint256 indexed fundId, address indexed manager, string name, address shareFacade);
    event StrategySet(uint256 indexed fundId);
    event StrategyRevealed(uint256 indexed fundId, uint256 wethBps);
    /// @dev Identity-free — only the fundId is logged. The cUSDC `Transfer` event at
    ///      the ERC-7984 layer still reveals the sender's address; that is an
    ///      unavoidable property of the token standard. Amounts remain encrypted.
    event Deposited(uint256 indexed fundId);
    event RedeemRequested(uint256 indexed fundId, address indexed user);
    event RedeemProcessed(uint256 indexed fundId, address indexed user);
    event RedeemClaimed(uint256 indexed fundId, address indexed user);
    event SupplyInitiated(uint256 indexed fundId, uint256 amount);
    event SuppliedToAave(uint256 indexed fundId, uint256 amount);
    event WithdrawnFromAave(uint256 indexed fundId, uint256 amount);

    // ── State ─────────────────────────────────────────────────────────────────

    struct Fund {
        address manager;
        string  name;
        string  description;
        uint256 createdAt;
        uint256 performanceFeeBps;
        address shareTokenFacade;

        // Encrypted strategy: WETH basis points (0-10000). USDC = 10000 - wethBps.
        euint256 encryptedWethBps;
        bool strategySet;

        // Reveal state
        bool    revealed;
        uint256 revealedWethBps;

        // ETH price at fund creation (for post-reveal allocation alpha)
        int256 startPriceEthE8;

        // Encrypted aggregate state (manager has ACL)
        euint256 totalAssets;  // encrypted cUSDC balance owned by this fund
        euint256 totalShares;

        // Aave real-yield accounting (plaintext — Aave leg is public)
        uint256 fundPrincipal;        // plaintext USDC currently supplied to Aave on this fund's behalf
        uint256 pendingSupplyAmount;  // plaintext amount awaiting finalizeSupply
        euint256 pendingUnwrapHandle; // handle from cUSDC.unwrap, consumed in finalizeSupply

        // Public metadata
        uint256 depositorCount;
        mapping(address => bool) hasPosition;

        // Per-user encrypted state
        mapping(address => euint256) shares;
        mapping(address => euint256) pendingRedeem;
        mapping(address => bool)     hasPendingRedeem;
        mapping(address => bool)     claimable;
        mapping(address => euint256) claimablePayable;
    }

    mapping(uint256 => Fund) private funds;
    uint256 public nextFundId;

    /// @notice Global sum of all fundPrincipals — denominator for proportional yield attribution.
    uint256 public totalPrincipalSum;

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

    function createFund(
        string calldata fundName,
        string calldata description,
        uint256 perfFeeBps
    ) external returns (uint256 fundId) {
        fundId = nextFundId++;
        Fund storage f = funds[fundId];

        f.manager           = msg.sender;
        f.name              = fundName;
        f.description       = description;
        f.createdAt         = block.timestamp;
        f.performanceFeeBps = perfFeeBps;

        // Snapshot ETH start price (USDC is always 1e8, no need to store)
        int256[2] memory startPrices = oracle.getAllPrices();
        f.startPriceEthE8 = startPrices[0];

        // Initialise encrypted aggregates
        f.totalAssets = Nox.toEuint256(0);
        Nox.allowThis(f.totalAssets);
        Nox.allow(f.totalAssets, msg.sender);

        f.totalShares = Nox.toEuint256(0);
        Nox.allowThis(f.totalShares);
        Nox.allow(f.totalShares, msg.sender);

        // Deploy ERC-7984 share-token facade
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
     * @notice Submit encrypted WETH allocation (basis points, 0-10000).
     *         USDC leg is implicit: 10000 - wethBps.
     *
     * @dev Trust assumption: manager submits a value in [0, 10000]. Nox cannot
     *      revert on an encrypted range check. The equality is auditable at reveal.
     *
     * @param fundId         Target fund.
     * @param wethBpsHandle  encryptInput(value, "uint256", vaultAddress).handle
     * @param proof          encryptInput(...).handleProof
     */
    function setStrategy(
        uint256 fundId,
        externalEuint256 wethBpsHandle,
        bytes calldata proof
    ) external onlyManager(fundId) fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (f.revealed) revert AlreadyRevealed();

        f.encryptedWethBps = Nox.fromExternal(wethBpsHandle, proof);
        Nox.allowThis(f.encryptedWethBps);
        Nox.allow(f.encryptedWethBps, msg.sender);

        f.strategySet = true;
        emit StrategySet(fundId);
    }

    /**
     * @notice Irreversibly reveal the strategy. Stores plaintext for scoring and
     *         makes the encrypted handle publicly decryptable for auditability.
     */
    function revealStrategy(
        uint256 fundId,
        uint256 plaintextWethBps
    ) external onlyManager(fundId) fundExists(fundId) {
        if (plaintextWethBps > 10_000) revert InvalidWethBps();
        Fund storage f = funds[fundId];
        if (f.revealed) revert AlreadyRevealed();

        f.revealedWethBps = plaintextWethBps;
        f.revealed        = true;

        if (f.strategySet) {
            Nox.allowPublicDecryption(f.encryptedWethBps);
            Nox.allowPublicDecryption(f.totalAssets);
        }

        emit StrategyRevealed(fundId, plaintextWethBps);
    }

    // ── Deposits (auto-mint via ERC-7984 receiver callback) ───────────────────

    /**
     * @notice ERC-7984 receiver callback. Depositor calls
     *         `cUSDC.confidentialTransferAndCall(vault, handle, proof, abi.encode(fundId))`
     *         and the cUSDC token forwards the already-ingested euint256 here.
     *
     * @dev Shares are minted 1:1 with the deposited cUSDC amount inside this
     *      callback — no manager action required. The proportional ERC-4626
     *      math happens at redeem time (see `_autoRedeem` / `processRedeem`),
     *      so Aave yield still flows to existing holders when they exit.
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
        Fund storage f = funds[fundId];
        if (f.manager == address(0)) revert FundNotFound();

        Nox.allowThis(amount);
        Nox.allow(amount, from);

        if (f.hasPosition[from]) {
            euint256 updatedShares = Nox.add(f.shares[from], amount);
            f.shares[from] = updatedShares;
            Nox.allowThis(updatedShares);
            Nox.allow(updatedShares, from);
        } else {
            f.shares[from] = amount;
            f.hasPosition[from] = true;
            f.depositorCount++;
        }

        euint256 updatedAssets = Nox.add(f.totalAssets, amount);
        f.totalAssets = updatedAssets;
        Nox.allowThis(updatedAssets);
        Nox.allow(updatedAssets, f.manager);

        euint256 updatedTotalShares = Nox.add(f.totalShares, amount);
        f.totalShares = updatedTotalShares;
        Nox.allowThis(updatedTotalShares);
        Nox.allow(updatedTotalShares, f.manager);

        emit Deposited(fundId);
        return Nox.toEbool(true);
    }

    // ── Redemptions (hybrid: auto when liquid, async when supplied to Aave) ───

    /**
     * @notice Redeem shares. Takes the fast path (atomic auto-settle) when the
     *         fund has no capital supplied to Aave, and falls back to the ERC-7540
     *         async queue otherwise (so the manager can first pull liquidity back
     *         from Aave, then call `processRedeem`).
     *
     * @dev Branching is on the plaintext `fundPrincipal` — this leaks nothing more
     *      than the already-public Aave supply state.
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

        if (f.fundPrincipal == 0) {
            // Fast path — fund is fully liquid, settle atomically
            _autoRedeem(f, fundId, msg.sender, shareAmt);
            return;
        }

        // Slow path — queue for the manager to process after pulling Aave liquidity
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
     * @dev ERC-4626 proportional burn-and-pay, all in the encrypted domain.
     *      Used by both the fast-path `requestRedeem` and by `processRedeem`
     *      (indirectly — the latter keeps its legacy two-step settle so the
     *      existing claim UI still works).
     */
    function _autoRedeem(
        Fund storage f,
        uint256 fundId,
        address user,
        euint256 shareAmt
    ) internal {
        // payoutAssets = shareAmt × totalAssets / totalShares
        euint256 product = Nox.mul(shareAmt, f.totalAssets);
        Nox.allowThis(product);
        euint256 payoutAssets = Nox.div(product, f.totalShares);
        Nox.allowThis(payoutAssets);
        Nox.allow(payoutAssets, user);

        // Burn user shares
        euint256 updatedUserShares = Nox.sub(f.shares[user], shareAmt);
        f.shares[user] = updatedUserShares;
        Nox.allowThis(updatedUserShares);
        Nox.allow(updatedUserShares, user);

        // Decrement encrypted totals
        euint256 updatedTotalShares = Nox.sub(f.totalShares, shareAmt);
        f.totalShares = updatedTotalShares;
        Nox.allowThis(updatedTotalShares);
        Nox.allow(updatedTotalShares, f.manager);

        euint256 updatedAssets = Nox.sub(f.totalAssets, payoutAssets);
        f.totalAssets = updatedAssets;
        Nox.allowThis(updatedAssets);
        Nox.allow(updatedAssets, f.manager);

        // Atomically transfer cUSDC to user (vault holds full liquid supply)
        Nox.allowTransient(payoutAssets, cUSDC);
        ICUSDC(cUSDC).confidentialTransfer(user, payoutAssets);

        emit RedeemClaimed(fundId, user);
    }

    function processRedeem(uint256 fundId, address user) external fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (!f.hasPendingRedeem[user]) revert NoPendingRedeem();

        euint256 redeemShares = f.pendingRedeem[user];

        // ERC-4626 math in the encrypted domain, BEFORE mutating totalShares:
        //   payoutAssets = redeemShares × totalAssets / totalShares
        // This makes each share worth a proportional slice of the fund's
        // cUSDC, so any Aave yield re-wrapped into totalAssets flows to
        // redeemers automatically.
        euint256 product = Nox.mul(redeemShares, f.totalAssets);
        Nox.allowThis(product);
        euint256 payoutAssets = Nox.div(product, f.totalShares);
        Nox.allowThis(payoutAssets);
        Nox.allow(payoutAssets, user);

        // Burn user shares
        euint256 updatedUserShares = Nox.sub(f.shares[user], redeemShares);
        f.shares[user] = updatedUserShares;
        Nox.allowThis(updatedUserShares);
        Nox.allow(updatedUserShares, user);

        // Decrement totalShares
        euint256 updatedTotalShares = Nox.sub(f.totalShares, redeemShares);
        f.totalShares = updatedTotalShares;
        Nox.allowThis(updatedTotalShares);
        Nox.allow(updatedTotalShares, f.manager);

        // Deduct payout (not redeemShares) from totalAssets
        euint256 updatedAssets = Nox.sub(f.totalAssets, payoutAssets);
        f.totalAssets = updatedAssets;
        Nox.allowThis(updatedAssets);
        Nox.allow(updatedAssets, f.manager);

        f.claimablePayable[user] = payoutAssets;

        f.pendingRedeem[user] = Nox.toEuint256(0);
        Nox.allowThis(f.pendingRedeem[user]);
        f.hasPendingRedeem[user] = false;
        f.claimable[user] = true;

        emit RedeemProcessed(fundId, user);
    }

    function claimRedemption(uint256 fundId) external fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (!f.claimable[msg.sender]) revert NoPendingRedeem();

        f.claimable[msg.sender] = false;

        euint256 amt = f.claimablePayable[msg.sender];
        Nox.allowTransient(amt, cUSDC);
        ICUSDC(cUSDC).confidentialTransfer(msg.sender, amt);

        f.claimablePayable[msg.sender] = Nox.toEuint256(0);
        Nox.allowThis(f.claimablePayable[msg.sender]);

        emit RedeemClaimed(fundId, msg.sender);
    }

    // ── Aave v3 real-yield flow ───────────────────────────────────────────────

    /**
     * @notice Step 1 of 2 — initiate an unwrap of the fund's cUSDC to plaintext USDC.
     *
     * @dev Creates a trivially-encrypted handle for `plaintextAmount` and calls
     *      cUSDC.unwrap(vault, vault, euint256) — this uses the euint256 overload
     *      which requires the handle to be ACL'd to the caller (the vault), not a
     *      user-provided external proof. No proof-binding issues.
     *
     *      The unwrap is split across two txs because cUSDC's finalizeUnwrap needs
     *      a decryptionProof produced off-chain by the Nox gateway (handleClient.publicDecrypt),
     *      mirroring the same pattern as hooks/use-unwrap.ts in the frontend.
     *
     *      Also decrements the fund's encrypted `totalAssets` by the plaintext amount
     *      (via a trivially-encrypted sub) to keep the vault's accounting in sync
     *      with cUSDC's balance.
     */
    function initiateSupply(uint256 fundId, uint256 plaintextAmount)
        external
        onlyManager(fundId)
        fundExists(fundId)
    {
        if (plaintextAmount == 0) revert ZeroAmount();
        Fund storage f = funds[fundId];
        if (f.pendingSupplyAmount != 0) revert SupplyAlreadyPending();

        // Trivially-encrypt the plaintext amount (value is publicly known)
        euint256 amt = Nox.toEuint256(plaintextAmount);
        Nox.allowThis(amt);
        Nox.allowTransient(amt, cUSDC);

        // Burn vault's cUSDC — returns the unwrap request handle
        euint256 unwrapHandle = ICUSDC(cUSDC).unwrap(address(this), address(this), amt);

        f.pendingSupplyAmount  = plaintextAmount;
        f.pendingUnwrapHandle  = unwrapHandle;

        // Keep internal totalAssets in lock-step with cUSDC balance
        euint256 subAmt = Nox.toEuint256(plaintextAmount);
        Nox.allowThis(subAmt);
        euint256 newTotal = Nox.sub(f.totalAssets, subAmt);
        f.totalAssets = newTotal;
        Nox.allowThis(newTotal);
        Nox.allow(newTotal, f.manager);

        emit SupplyInitiated(fundId, plaintextAmount);
    }

    /**
     * @notice Step 2 of 2 — complete the unwrap and supply to Aave v3.
     *
     * @dev `decryptionProof` is fetched off-chain by the manager via
     *      handleClient.publicDecrypt(handle). cUSDC.finalizeUnwrap transfers
     *      the plaintext USDC to the vault, then the vault approves + calls
     *      Aave.supply.
     */
    function finalizeSupply(uint256 fundId, bytes calldata decryptionProof)
        external
        onlyManager(fundId)
        fundExists(fundId)
    {
        Fund storage f = funds[fundId];
        uint256 amount = f.pendingSupplyAmount;
        if (amount == 0) revert NoPendingSupply();

        euint256 handle = f.pendingUnwrapHandle;

        // Clear pending state before external calls (CEI)
        f.pendingSupplyAmount = 0;
        f.pendingUnwrapHandle = Nox.toEuint256(0);

        // Finalize unwrap — transfers plaintext USDC to this vault
        ICUSDC(cUSDC).finalizeUnwrap(handle, decryptionProof);

        // Approve Aave pool and supply
        IERC20Min(AaveAddresses.USDC).approve(AaveAddresses.POOL, amount);
        try IAavePool(AaveAddresses.POOL).supply(AaveAddresses.USDC, amount, address(this), 0) {
            // ok
        } catch {
            revert AaveSupplyFailed();
        }

        f.fundPrincipal    += amount;
        totalPrincipalSum  += amount;

        emit SuppliedToAave(fundId, amount);
    }

    /**
     * @notice Withdraw USDC from Aave back to the vault and re-wrap as cUSDC.
     *
     * @dev Pro-rata cap: a fund can withdraw at most its share of the vault's
     *      aUSDC balance (fundPrincipal / totalPrincipalSum × balance). Prevents
     *      one manager draining another fund's yield.
     *
     *      Yield distribution: the plaintext amount withdrawn (which may exceed
     *      `fundPrincipal` if interest accrued) is re-wrapped into cUSDC and added
     *      to `f.totalAssets` via a trivially-encrypted add. Depositors benefit
     *      proportionally because their share count is unchanged but totalAssets grew.
     */
    function withdrawFromAave(uint256 fundId, uint256 plaintextAmount)
        external
        onlyManager(fundId)
        fundExists(fundId)
    {
        if (plaintextAmount == 0) revert ZeroAmount();
        Fund storage f = funds[fundId];

        uint256 aBal = IERC20Min(AaveAddresses.AUSDC).balanceOf(address(this));
        uint256 fundAValue = totalPrincipalSum == 0
            ? 0
            : (f.fundPrincipal * aBal) / totalPrincipalSum;
        if (plaintextAmount > fundAValue) revert InsufficientFundAValue();

        // Withdraw from Aave — USDC lands in this vault
        try IAavePool(AaveAddresses.POOL).withdraw(AaveAddresses.USDC, plaintextAmount, address(this)) returns (uint256) {
            // ok
        } catch {
            revert AaveWithdrawFailed();
        }

        // Re-wrap plaintext USDC into cUSDC (vault becomes the holder)
        IERC20Min(AaveAddresses.USDC).approve(cUSDC, plaintextAmount);
        ICUSDC(cUSDC).wrap(address(this), plaintextAmount);

        // Add the re-wrapped amount to encrypted totalAssets (trivially encrypted)
        euint256 addAmt = Nox.toEuint256(plaintextAmount);
        Nox.allowThis(addAmt);
        euint256 newTotal = Nox.add(f.totalAssets, addAmt);
        f.totalAssets = newTotal;
        Nox.allowThis(newTotal);
        Nox.allow(newTotal, f.manager);

        // Reduce principal by the withdrawn amount (capped at fundPrincipal).
        // Any excess is realized yield.
        uint256 reduce = plaintextAmount > f.fundPrincipal ? f.fundPrincipal : plaintextAmount;
        f.fundPrincipal   -= reduce;
        totalPrincipalSum -= reduce;

        emit WithdrawnFromAave(fundId, plaintextAmount);
    }

    // ── ERC-7540 canonical stubs ──────────────────────────────────────────────

    function pendingDepositRequest(uint256, address) external pure returns (uint256) { revert NotImplemented(); }
    function claimableDepositRequest(uint256, address) external pure returns (uint256) { revert NotImplemented(); }
    function pendingRedeemRequest(uint256, address) external pure returns (uint256) { revert NotImplemented(); }
    function claimableRedeemRequest(uint256, address) external pure returns (uint256) { revert NotImplemented(); }
    function deposit(uint256, address, address) external pure returns (uint256) { revert NotImplemented(); }
    function redeem(uint256, address, address) external pure returns (uint256) { revert NotImplemented(); }

    // ── View functions ────────────────────────────────────────────────────────

    function shareBalanceOf(uint256 fundId, address user)
        external
        view
        fundExists(fundId)
        returns (bytes32)
    {
        return euint256.unwrap(funds[fundId].shares[user]);
    }

    function shareTotalSupply(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (bytes32)
    {
        return euint256.unwrap(funds[fundId].totalShares);
    }

    /**
     * @notice Encrypted total cUSDC held by the fund (including idle + Aave-earmarked).
     *         Decryptable only by the fund manager — the ACL is re-granted on every
     *         mutation (deposit, redeem, initiateSupply, withdrawFromAave).
     */
    function getFundTotalAssets(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (bytes32)
    {
        return euint256.unwrap(funds[fundId].totalAssets);
    }

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
     * @notice Returns the revealed WETH bps. USDC bps is implicit (10000 - wethBps).
     */
    function getRevealedStrategy(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (uint256 wethBps, uint256 usdcBps)
    {
        Fund storage f = funds[fundId];
        if (!f.revealed) revert NotRevealed();
        wethBps = f.revealedWethBps;
        usdcBps = 10_000 - wethBps;
    }

    /**
     * @notice Allocation Alpha vs 50/50 benchmark, in bps.
     *
     *         Pure ETH leg: wethBps × ((ethNow − ethStart) / ethStart)
     *         USDC leg contributes 0 (USDC is pegged to $1).
     *         Benchmark: 5000 × ((ethNow − ethStart) / ethStart)
     *         Alpha = wethBps_return − benchmark_return
     *
     *         Positive = manager's allocation beat a 50/50 hold.
     */
    function getPerformanceScoreBps(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (int256 scoreBps)
    {
        Fund storage f = funds[fundId];
        if (!f.revealed) revert NotRevealed();
        if (f.startPriceEthE8 <= 0) return 0;

        int256 ethNow = oracle.getAllPrices()[0];
        int256 priceDelta = ethNow - f.startPriceEthE8;

        // return in bps for both the manager allocation and the 50/50 benchmark
        int256 managerReturn   = (int256(f.revealedWethBps) * priceDelta * 100) / f.startPriceEthE8;
        int256 benchmarkReturn = (int256(5_000)             * priceDelta * 100) / f.startPriceEthE8;

        scoreBps = managerReturn - benchmarkReturn;
    }

    function getStartPriceEth(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (int256)
    {
        return funds[fundId].startPriceEthE8;
    }

    function hasPendingRedeem(uint256 fundId, address user) external view returns (bool) {
        return funds[fundId].hasPendingRedeem[user];
    }

    function isClaimable(uint256 fundId, address user) external view returns (bool) {
        return funds[fundId].claimable[user];
    }

    // ── Aave yield views ──────────────────────────────────────────────────────

    function getFundPrincipal(uint256 fundId) external view fundExists(fundId) returns (uint256) {
        return funds[fundId].fundPrincipal;
    }

    function getFundAValue(uint256 fundId) external view fundExists(fundId) returns (uint256) {
        if (totalPrincipalSum == 0) return 0;
        uint256 aBal = IERC20Min(AaveAddresses.AUSDC).balanceOf(address(this));
        return (funds[fundId].fundPrincipal * aBal) / totalPrincipalSum;
    }

    function getFundYield(uint256 fundId) external view fundExists(fundId) returns (int256) {
        if (totalPrincipalSum == 0) return 0;
        uint256 aBal = IERC20Min(AaveAddresses.AUSDC).balanceOf(address(this));
        uint256 fundAValue = (funds[fundId].fundPrincipal * aBal) / totalPrincipalSum;
        return int256(fundAValue) - int256(funds[fundId].fundPrincipal);
    }

    function getPendingSupplyAmount(uint256 fundId) external view fundExists(fundId) returns (uint256) {
        return funds[fundId].pendingSupplyAmount;
    }

    function getPendingUnwrapHandle(uint256 fundId) external view fundExists(fundId) returns (bytes32) {
        return euint256.unwrap(funds[fundId].pendingUnwrapHandle);
    }

    function getCurrentAaveApyBps() external view returns (uint256) {
        return oracle.getAaveUsdcSupplyApyBps();
    }

    function getVaultAUsdcBalance() external view returns (uint256) {
        return IERC20Min(AaveAddresses.AUSDC).balanceOf(address(this));
    }
}
