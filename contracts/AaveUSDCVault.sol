// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISubVault} from "./ISubVault.sol";
import {IAavePool, IAaveDataProvider} from "./IAavePool.sol";
import {AaveAddresses} from "./AaveAddresses.sol";

/**
 * @title AaveUSDCVault
 * @notice ERC-4626 sub-vault that supplies all deposited USDC to Aave v3.
 *
 *         Flow:
 *           deposit(N USDC) → Aave.supply(USDC, N) → aUSDC balance grows
 *           redeem(shares) → Aave.withdraw(USDC, proRata) → USDC returned
 *
 *         totalAssets() == aUSDC.balanceOf(this), so shares track real yield
 *         automatically. No manager action required to accrue yield.
 */
contract AaveUSDCVault is ERC4626, ISubVault {
    using SafeERC20 for IERC20;

    IAavePool public immutable POOL;
    IERC20 public immutable AUSDC;
    IAaveDataProvider public immutable DATA_PROVIDER;
    address public immutable USDC_ADDRESS;

    uint256 private constant RAY = 1e27;

    error AaveSupplyFailed();
    error AaveWithdrawFailed();

    constructor()
        ERC20("ShadowFund Aave USDC", "sfaUSDC")
        ERC4626(IERC20(AaveAddresses.USDC))
    {
        POOL = IAavePool(AaveAddresses.POOL);
        AUSDC = IERC20(AaveAddresses.AUSDC);
        DATA_PROVIDER = IAaveDataProvider(AaveAddresses.POOL_DATA_PROVIDER);
        USDC_ADDRESS = AaveAddresses.USDC;
    }

    // ── ISubVault / ERC4626 ────────────────────────────────────────────────

    function totalAssets() public view override(ERC4626, ISubVault) returns (uint256) {
        return AUSDC.balanceOf(address(this));
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

    function getSupplyAPYBps() external view returns (uint256) {
        (, , , , , uint256 liquidityRate, , , , , , ) = DATA_PROVIDER.getReserveData(USDC_ADDRESS);
        return (liquidityRate * 10000) / RAY;
    }

    // ── Hooks into Aave ────────────────────────────────────────────────────

    /// @dev After USDC flows in, supply it straight to Aave so every asset in
    /// the vault is always earning.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
    {
        super._deposit(caller, receiver, assets, shares);

        IERC20(USDC_ADDRESS).forceApprove(address(POOL), assets);
        try POOL.supply(USDC_ADDRESS, assets, address(this), 0) {
            // ok
        } catch {
            revert AaveSupplyFailed();
        }
    }

    /// @dev Before USDC flows out, pull it from Aave. `assets` may be slightly
    /// larger than the raw deposit due to accrued yield.
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        try POOL.withdraw(USDC_ADDRESS, assets, address(this)) returns (uint256) {
            // ok
        } catch {
            revert AaveWithdrawFailed();
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }
}
