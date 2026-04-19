// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISubVault} from "./ISubVault.sol";
import {AaveAddresses} from "./AaveAddresses.sol";

/**
 * @title FixedYieldVault
 * @notice Pays a fixed ~8% APY on USDC deposits out of a deployer-seeded reward pool.
 *
 *         Accounting:
 *           - Vault's USDC.balanceOf(this) == trackedAssets + remainingRewardPool.
 *           - trackedAssets grows each interaction via `_accrue()`, which moves
 *             USDC from rewardPool → trackedAssets at rateBps × elapsed / 365d.
 *           - totalAssets() returns a live preview including unsettled accrual
 *             so share price reflects the real claim at any instant.
 *
 *         If the reward pool runs out, accrual caps at 0 and the vault becomes
 *         flat-yield until someone tops it up via `topUpRewardPool`.
 */
contract FixedYieldVault is ERC4626, ISubVault {
    using SafeERC20 for IERC20;

    uint256 public constant RATE_BPS = 800;       // 8% APY
    uint256 private constant YEAR = 365 days;
    uint256 private constant BPS_DENOM = 10_000;

    uint256 public trackedAssets;
    uint256 public rewardPool;
    uint256 public lastAccrualTs;

    event Accrued(uint256 amount);
    event RewardPoolFunded(address indexed from, uint256 amount);

    error RewardPoolEmpty();

    constructor()
        ERC20("ShadowFund Fixed Yield", "sfFIXED")
        ERC4626(IERC20(AaveAddresses.USDC))
    {
        lastAccrualTs = block.timestamp;
    }

    // ── Seeding / top-ups ──────────────────────────────────────────────────

    /// @notice Fund the reward pool. Caller must have approved USDC to this vault.
    function fundRewardPool(uint256 amount) external {
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(msg.sender, amount);
    }

    // ── ISubVault surface ──────────────────────────────────────────────────

    function totalAssets() public view override(ERC4626, ISubVault) returns (uint256) {
        return trackedAssets + _previewAccrual();
    }

    function asset() public view override(ERC4626, ISubVault) returns (address) {
        return super.asset();
    }

    function deposit(uint256 assets, address receiver)
        public
        override(ERC4626, ISubVault)
        returns (uint256)
    {
        return super.deposit(assets, receiver);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override(ERC4626, ISubVault)
        returns (uint256)
    {
        return super.redeem(shares, receiver, owner);
    }

    function convertToAssets(uint256 shares)
        public
        view
        override(ERC4626, ISubVault)
        returns (uint256)
    {
        return super.convertToAssets(shares);
    }

    function getSupplyAPYBps() external pure returns (uint256) {
        return RATE_BPS;
    }

    // ── Hooks ──────────────────────────────────────────────────────────────

    /// @dev Accrue BEFORE deposit so share price reflects all unsettled yield.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
    {
        _accrue();
        super._deposit(caller, receiver, assets, shares);
        trackedAssets += assets;
    }

    /// @dev Accrue BEFORE withdraw for the same reason.
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        _accrue();
        if (assets > trackedAssets) {
            trackedAssets = 0;
        } else {
            trackedAssets -= assets;
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    // ── Accrual logic ──────────────────────────────────────────────────────

    function _accrue() internal {
        uint256 yieldAmt = _previewAccrual();
        lastAccrualTs = block.timestamp;
        if (yieldAmt == 0) return;

        rewardPool -= yieldAmt;
        trackedAssets += yieldAmt;
        emit Accrued(yieldAmt);
    }

    function _previewAccrual() internal view returns (uint256) {
        if (rewardPool == 0 || trackedAssets == 0) return 0;
        uint256 elapsed = block.timestamp - lastAccrualTs;
        if (elapsed == 0) return 0;
        uint256 raw = (trackedAssets * RATE_BPS * elapsed) / (BPS_DENOM * YEAR);
        return raw > rewardPool ? rewardPool : raw;
    }
}
