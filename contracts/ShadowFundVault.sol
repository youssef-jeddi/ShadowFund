// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC7984Receiver} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984Receiver.sol";
import {ShadowFundShareToken} from "./ShadowFundShareToken.sol";
import {IERC20Min} from "./IAavePool.sol";
import {AaveAddresses} from "./AaveAddresses.sol";
import {ISubVault} from "./ISubVault.sol";

/**
 * @title ShadowFundVault — Input-Privacy Confidential Allocator
 * @notice Confidential USDC yield vault. Depositor position sizes are encrypted
 *         per-address (Nox euint256); manager allocation across sub-vaults is
 *         fully public. Routes cUSDC across two ERC-4626 sub-vaults:
 *
 *           - AaveUSDCVault  (real Aave v3 USDC supply yield, variable ~4% APY)
 *           - FixedYieldVault (deployer-seeded reward pool, fixed 8% APY)
 *
 *         The privacy claim: a whale depositing $1M and a retail user depositing
 *         $100 are indistinguishable on-chain in amount. Only the depositor's
 *         own wallet can decrypt their shares and lifetime deposited handles via
 *         the Nox handle client.
 *
 * Core surfaces:
 *   - Auto-deposit: ERC-7984 `confidentialTransferAndCall` fires
 *     `onConfidentialTransferReceived` → mints 1:1 encrypted shares.
 *   - Hybrid redeem: atomic fast-path when `_totalDeployed == 0`; ERC-7540-style
 *     slow queue when capital is deployed (manager withdraws, processes, user claims).
 *   - Bulk deploy: 2-step TEE unwrap. `deployCapital(amount)` unwraps encrypted
 *     cUSDC aggregate → TEE cooldown → `finalizeDeployCapital` fans out plaintext
 *     USDC to sub-vaults per public `allocationBps`.
 *
 * Privacy map:
 *   - `shares[depositor]`    euint256, depositor-ACL'd
 *   - `deposited[depositor]` euint256, depositor-ACL'd (cumulative lifetime gross)
 *   - `totalAssets`          euint256, manager-ACL'd
 *   - `totalShares`          euint256, manager-ACL'd
 *   - `allocationBps[2]`     plaintext (everyone)
 *   - `subVaultShares`       plaintext (everyone)
 *
 * Known simplification:
 *   - `deposited` is lifetime gross, not cost-basis. UI yield display is
 *     approximate for users with partial redeems. Documented in feedback.md.
 */

interface ICUSDC {
    function confidentialTransfer(
        address to,
        euint256 amount
    ) external returns (euint256);

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
    error NoPendingRedeem();
    error NotImplemented();
    error OnlyCUSDC();
    error InvalidCallbackData();
    error InvalidAllocationSum();
    error AllocationNotSet();
    error AllocationUpdateBlockedByPendingDeploy();
    error ZeroAmount();
    error DeployAlreadyPending();
    error NoPendingDeploy();
    error InsufficientDeployed();
    error SubVaultDepositFailed(uint256 vaultIdx);
    error SubVaultWithdrawFailed(uint256 vaultIdx);
    error BadArrayLength();

    // ── Events ────────────────────────────────────────────────────────────────

    event FundCreated(
        uint256 indexed fundId,
        address indexed manager,
        string name,
        address shareFacade,
        uint256 bps0,
        uint256 bps1
    );
    event AllocationUpdated(uint256 indexed fundId, uint256 bps0, uint256 bps1);
    /// @dev Identity-free — only the fundId is logged. The cUSDC `Transfer` event at
    ///      the ERC-7984 layer still reveals the sender's address.
    event Deposited(uint256 indexed fundId);
    event RedeemRequested(uint256 indexed fundId, address indexed user);
    event RedeemProcessed(uint256 indexed fundId, address indexed user);
    event RedeemClaimed(uint256 indexed fundId, address indexed user);
    event DeployInitiated(uint256 indexed fundId, uint256 amount);
    event CapitalDeployed(uint256 indexed fundId, uint256 total, uint256 slice0, uint256 slice1);
    event CapitalWithdrawn(uint256 indexed fundId, uint256 total, uint256 out0, uint256 out1);

    // ── State ─────────────────────────────────────────────────────────────────

    uint256 public constant VAULT_COUNT = 2;
    uint256 public constant AAVE_USDC_IDX = 0;
    uint256 public constant FIXED_IDX = 1;

    struct Fund {
        address manager;
        string  name;
        string  description;
        uint256 createdAt;
        uint256 performanceFeeBps;
        address shareTokenFacade;

        // Public allocation — sum must equal 10000.
        uint256[VAULT_COUNT] allocationBps;
        bool allocationSet;

        // Encrypted aggregates (manager has ACL)
        euint256 totalAssets;   // encrypted cUSDC currently held by the vault for this fund
        euint256 totalShares;

        // Pending deploy state (2-step TEE unwrap)
        uint256 pendingDeployAmount;
        euint256 pendingUnwrapHandle;

        // Public metadata
        uint256 depositorCount;
        mapping(address => bool) hasPosition;

        // Per-depositor encrypted state (depositor has ACL on their own handles)
        mapping(address => euint256) shares;
        mapping(address => euint256) deposited;       // cumulative lifetime gross, never decremented
        mapping(address => euint256) pendingRedeem;
        mapping(address => bool)     hasPendingRedeem;
        mapping(address => bool)     claimable;
        mapping(address => euint256) claimablePayable;
    }

    mapping(uint256 => Fund) private funds;
    uint256 public nextFundId;

    /// @notice fundId → sub-vault index → shares held by this fund in that sub-vault.
    mapping(uint256 => mapping(uint256 => uint256)) public subVaultShares;

    address public immutable cUSDC;
    address[VAULT_COUNT] public approvedVaults;

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _cUSDC, address[VAULT_COUNT] memory _approvedVaults) {
        require(_cUSDC != address(0), "ShadowFundVault: zero cUSDC");
        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            require(_approvedVaults[i] != address(0), "ShadowFundVault: zero sub-vault");
        }
        cUSDC = _cUSDC;
        approvedVaults = _approvedVaults;
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
     * @notice Create a fund with a public allocation across sub-vaults.
     * @param fundName          human-readable fund name
     * @param description       short blurb
     * @param perfFeeBps        performance fee (display only, not deducted)
     * @param allocationBps_    [aaveUsdcBps, fixedBps], must sum to 10000
     */
    function createFund(
        string calldata fundName,
        string calldata description,
        uint256 perfFeeBps,
        uint256[VAULT_COUNT] calldata allocationBps_
    ) external returns (uint256 fundId) {
        uint256 sum;
        for (uint256 i = 0; i < VAULT_COUNT; i++) sum += allocationBps_[i];
        if (sum != 10_000) revert InvalidAllocationSum();

        fundId = nextFundId++;
        Fund storage f = funds[fundId];

        f.manager           = msg.sender;
        f.name              = fundName;
        f.description       = description;
        f.createdAt         = block.timestamp;
        f.performanceFeeBps = perfFeeBps;

        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            f.allocationBps[i] = allocationBps_[i];
        }
        f.allocationSet = true;

        f.totalAssets = Nox.toEuint256(0);
        Nox.allowThis(f.totalAssets);
        Nox.allow(f.totalAssets, msg.sender);

        f.totalShares = Nox.toEuint256(0);
        Nox.allowThis(f.totalShares);
        Nox.allow(f.totalShares, msg.sender);

        ShadowFundShareToken facade = new ShadowFundShareToken(
            address(this),
            fundId,
            string(abi.encodePacked("ShadowFund-", fundName, " Shares")),
            string(abi.encodePacked("sfUSDC-", fundName))
        );
        f.shareTokenFacade = address(facade);

        emit FundCreated(fundId, msg.sender, fundName, address(facade), allocationBps_[0], allocationBps_[1]);
    }

    /**
     * @notice Update the public allocation. Affects only future `finalizeDeployCapital`
     *         slices — does NOT rebalance already-deployed capital in sub-vaults.
     *         Blocked while a deploy is mid-flight to prevent mid-tx slice drift.
     */
    function updateAllocation(
        uint256 fundId,
        uint256[VAULT_COUNT] calldata newBps
    ) external onlyManager(fundId) fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (f.pendingDeployAmount != 0) revert AllocationUpdateBlockedByPendingDeploy();

        uint256 sum;
        for (uint256 i = 0; i < VAULT_COUNT; i++) sum += newBps[i];
        if (sum != 10_000) revert InvalidAllocationSum();

        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            f.allocationBps[i] = newBps[i];
        }

        emit AllocationUpdated(fundId, newBps[0], newBps[1]);
    }

    // ── Deposits (auto-mint via ERC-7984 receiver callback) ───────────────────

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
            // Update running shares balance
            euint256 newShares = Nox.add(f.shares[from], amount);
            f.shares[from] = newShares;
            Nox.allowThis(newShares);
            Nox.allow(newShares, from);

            // Update lifetime deposited (never decremented)
            euint256 newDeposited = Nox.add(f.deposited[from], amount);
            f.deposited[from] = newDeposited;
            Nox.allowThis(newDeposited);
            Nox.allow(newDeposited, from);
        } else {
            f.shares[from] = amount;
            f.deposited[from] = amount;
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

    // ── Redemptions (hybrid: auto when liquid, async when capital deployed) ──

    function requestRedeem(
        uint256 fundId,
        externalEuint256 shares,
        bytes calldata proof
    ) external fundExists(fundId) {
        Fund storage f = funds[fundId];

        euint256 shareAmt = Nox.fromExternal(shares, proof);
        Nox.allowThis(shareAmt);
        Nox.allow(shareAmt, msg.sender);

        if (_totalDeployed(fundId) == 0) {
            _autoRedeem(f, fundId, msg.sender, shareAmt);
            return;
        }

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

    function _autoRedeem(
        Fund storage f,
        uint256 fundId,
        address user,
        euint256 shareAmt
    ) internal {
        euint256 product = Nox.mul(shareAmt, f.totalAssets);
        Nox.allowThis(product);
        euint256 payoutAssets = Nox.div(product, f.totalShares);
        Nox.allowThis(payoutAssets);
        Nox.allow(payoutAssets, user);

        euint256 updatedUserShares = Nox.sub(f.shares[user], shareAmt);
        f.shares[user] = updatedUserShares;
        Nox.allowThis(updatedUserShares);
        Nox.allow(updatedUserShares, user);

        euint256 updatedTotalShares = Nox.sub(f.totalShares, shareAmt);
        f.totalShares = updatedTotalShares;
        Nox.allowThis(updatedTotalShares);
        Nox.allow(updatedTotalShares, f.manager);

        euint256 updatedAssets = Nox.sub(f.totalAssets, payoutAssets);
        f.totalAssets = updatedAssets;
        Nox.allowThis(updatedAssets);
        Nox.allow(updatedAssets, f.manager);

        Nox.allowTransient(payoutAssets, cUSDC);
        ICUSDC(cUSDC).confidentialTransfer(user, payoutAssets);

        emit RedeemClaimed(fundId, user);
    }

    function processRedeem(uint256 fundId, address user) external fundExists(fundId) {
        Fund storage f = funds[fundId];
        if (!f.hasPendingRedeem[user]) revert NoPendingRedeem();

        euint256 redeemShares = f.pendingRedeem[user];

        euint256 product = Nox.mul(redeemShares, f.totalAssets);
        Nox.allowThis(product);
        euint256 payoutAssets = Nox.div(product, f.totalShares);
        Nox.allowThis(payoutAssets);
        Nox.allow(payoutAssets, user);

        euint256 updatedUserShares = Nox.sub(f.shares[user], redeemShares);
        f.shares[user] = updatedUserShares;
        Nox.allowThis(updatedUserShares);
        Nox.allow(updatedUserShares, user);

        euint256 updatedTotalShares = Nox.sub(f.totalShares, redeemShares);
        f.totalShares = updatedTotalShares;
        Nox.allowThis(updatedTotalShares);
        Nox.allow(updatedTotalShares, f.manager);

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

    // ── Capital deployment (bulk fan-out to sub-vaults) ──────────────────────

    /**
     * @notice Step 1 of 2 — initiate the cUSDC unwrap for a bulk deployment.
     *         `finalizeDeployCapital` completes the deployment after the TEE cooldown.
     */
    function deployCapital(uint256 fundId, uint256 plaintextAmount)
        external
        onlyManager(fundId)
        fundExists(fundId)
    {
        if (plaintextAmount == 0) revert ZeroAmount();
        Fund storage f = funds[fundId];
        if (!f.allocationSet) revert AllocationNotSet();
        if (f.pendingDeployAmount != 0) revert DeployAlreadyPending();

        euint256 amt = Nox.toEuint256(plaintextAmount);
        Nox.allowThis(amt);
        Nox.allowTransient(amt, cUSDC);

        euint256 unwrapHandle = ICUSDC(cUSDC).unwrap(address(this), address(this), amt);

        f.pendingDeployAmount = plaintextAmount;
        f.pendingUnwrapHandle = unwrapHandle;

        euint256 subAmt = Nox.toEuint256(plaintextAmount);
        Nox.allowThis(subAmt);
        euint256 newTotal = Nox.sub(f.totalAssets, subAmt);
        f.totalAssets = newTotal;
        Nox.allowThis(newTotal);
        Nox.allow(newTotal, f.manager);

        emit DeployInitiated(fundId, plaintextAmount);
    }

    /**
     * @notice Step 2 of 2 — finalize the unwrap and fan plaintext USDC out to
     *         the two sub-vaults per `allocationBps`. Last slice gets the
     *         rounding remainder to avoid dust.
     */
    function finalizeDeployCapital(uint256 fundId, bytes calldata decryptionProof)
        external
        onlyManager(fundId)
        fundExists(fundId)
    {
        Fund storage f = funds[fundId];
        uint256 amount = f.pendingDeployAmount;
        if (amount == 0) revert NoPendingDeploy();

        euint256 handle = f.pendingUnwrapHandle;

        f.pendingDeployAmount = 0;
        f.pendingUnwrapHandle = Nox.toEuint256(0);

        ICUSDC(cUSDC).finalizeUnwrap(handle, decryptionProof);

        uint256[VAULT_COUNT] memory slices;
        uint256 sliceSum;
        for (uint256 i = 0; i < VAULT_COUNT - 1; i++) {
            slices[i] = (amount * f.allocationBps[i]) / 10_000;
            sliceSum += slices[i];
        }
        slices[VAULT_COUNT - 1] = amount - sliceSum;

        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            if (slices[i] == 0) continue;
            IERC20Min(AaveAddresses.USDC).approve(approvedVaults[i], slices[i]);
            try ISubVault(approvedVaults[i]).deposit(slices[i], address(this)) returns (uint256 sharesMinted) {
                subVaultShares[fundId][i] += sharesMinted;
            } catch {
                revert SubVaultDepositFailed(i);
            }
        }

        emit CapitalDeployed(fundId, amount, slices[0], slices[1]);
    }

    /**
     * @notice Pull `usdcAmount` USDC back from both sub-vaults proportional to
     *         the fund's current exposure in each. Re-wraps as cUSDC so the
     *         encrypted totalAssets grows — yield auto-accrues to share holders.
     */
    function withdrawCapital(uint256 fundId, uint256 usdcAmount)
        external
        onlyManager(fundId)
        fundExists(fundId)
    {
        if (usdcAmount == 0) revert ZeroAmount();
        Fund storage f = funds[fundId];

        uint256[VAULT_COUNT] memory values;
        uint256 totalDeployed;
        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            uint256 subShares = subVaultShares[fundId][i];
            values[i] = subShares == 0 ? 0 : ISubVault(approvedVaults[i]).convertToAssets(subShares);
            totalDeployed += values[i];
        }
        if (usdcAmount > totalDeployed) revert InsufficientDeployed();

        uint256[VAULT_COUNT] memory outs;
        uint256 totalOut;
        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            if (values[i] == 0) continue;
            uint256 sharesToRedeem;
            if (i == VAULT_COUNT - 1) {
                // Last slot gets the remainder of `usdcAmount`.
                uint256 targetOut = usdcAmount - totalOut;
                if (targetOut == 0) break;
                if (targetOut >= values[i]) {
                    sharesToRedeem = subVaultShares[fundId][i];
                } else {
                    sharesToRedeem = (subVaultShares[fundId][i] * targetOut) / values[i];
                }
            } else {
                sharesToRedeem = (subVaultShares[fundId][i] * usdcAmount) / totalDeployed;
            }
            if (sharesToRedeem == 0) continue;
            try ISubVault(approvedVaults[i]).redeem(sharesToRedeem, address(this), address(this)) returns (uint256 assetsOut) {
                outs[i] = assetsOut;
                totalOut += assetsOut;
                subVaultShares[fundId][i] -= sharesToRedeem;
            } catch {
                revert SubVaultWithdrawFailed(i);
            }
        }

        IERC20Min(AaveAddresses.USDC).approve(cUSDC, totalOut);
        ICUSDC(cUSDC).wrap(address(this), totalOut);

        euint256 addAmt = Nox.toEuint256(totalOut);
        Nox.allowThis(addAmt);
        euint256 newTotal = Nox.add(f.totalAssets, addAmt);
        f.totalAssets = newTotal;
        Nox.allowThis(newTotal);
        Nox.allow(newTotal, f.manager);

        emit CapitalWithdrawn(fundId, totalOut, outs[0], outs[1]);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _totalDeployed(uint256 fundId) internal view returns (uint256 total) {
        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            uint256 subShares = subVaultShares[fundId][i];
            if (subShares == 0) continue;
            total += ISubVault(approvedVaults[i]).convertToAssets(subShares);
        }
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

    function getFundTotalAssets(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (bytes32)
    {
        return euint256.unwrap(funds[fundId].totalAssets);
    }

    function getDepositorHandles(uint256 fundId, address user)
        external
        view
        fundExists(fundId)
        returns (bytes32 sharesHandle, bytes32 depositedHandle)
    {
        Fund storage f = funds[fundId];
        sharesHandle = euint256.unwrap(f.shares[user]);
        depositedHandle = euint256.unwrap(f.deposited[user]);
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
            bool allocationSet,
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
            f.allocationSet,
            f.depositorCount,
            f.shareTokenFacade
        );
    }

    function getAllocation(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (uint256[VAULT_COUNT] memory)
    {
        return funds[fundId].allocationBps;
    }

    function getSubVaultShares(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (uint256[VAULT_COUNT] memory out)
    {
        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            out[i] = subVaultShares[fundId][i];
        }
    }

    function getFundTotalDeployed(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (uint256)
    {
        return _totalDeployed(fundId);
    }

    function getSubVaultAPYs() external view returns (uint256[VAULT_COUNT] memory out) {
        for (uint256 i = 0; i < VAULT_COUNT; i++) {
            out[i] = ISubVault(approvedVaults[i]).getSupplyAPYBps();
        }
    }

    function getApprovedVaults() external view returns (address[VAULT_COUNT] memory) {
        return approvedVaults;
    }

    function getPendingDeployAmount(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (uint256)
    {
        return funds[fundId].pendingDeployAmount;
    }

    function getPendingUnwrapHandle(uint256 fundId)
        external
        view
        fundExists(fundId)
        returns (bytes32)
    {
        return euint256.unwrap(funds[fundId].pendingUnwrapHandle);
    }

    function hasPendingRedeem(uint256 fundId, address user) external view returns (bool) {
        return funds[fundId].hasPendingRedeem[user];
    }

    function isClaimable(uint256 fundId, address user) external view returns (bool) {
        return funds[fundId].claimable[user];
    }
}
