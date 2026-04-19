// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ISubVault
 * @notice Minimal ERC-4626 subset the ShadowFund meta-vault depends on, plus
 *         a display-only APY getter. Shares in every sub-vault are denominated
 *         in USDC (even AaveWETHVault, which routes USDC through WETH internally).
 */
interface ISubVault {
    function asset() external view returns (address);

    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    function convertToAssets(uint256 shares) external view returns (uint256);

    function totalAssets() external view returns (uint256);

    function getSupplyAPYBps() external view returns (uint256);
}
