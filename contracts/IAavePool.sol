// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IAavePool
 * @notice Minimal Aave v3 Pool interface — supply + withdraw only.
 *         The vault never borrows, so IAaveDataProvider.getReserveData is only
 *         consumed for display (liquidityRate → APY).
 */
interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

/**
 * @title IAaveDataProvider
 * @notice Subset of Aave v3 PoolDataProvider. We only read liquidityRate for APY display.
 *         liquidityRate is scaled to RAY (1e27) and is already annualised.
 */
interface IAaveDataProvider {
    function getReserveData(address asset)
        external
        view
        returns (
            uint256 unbacked,
            uint256 accruedToTreasuryScaled,
            uint256 totalAToken,
            uint256 totalStableDebt,
            uint256 totalVariableDebt,
            uint256 liquidityRate,
            uint256 variableBorrowRate,
            uint256 stableBorrowRate,
            uint256 averageStableBorrowRate,
            uint256 liquidityIndex,
            uint256 variableBorrowIndex,
            uint40  lastUpdateTimestamp
        );
}

/**
 * @title IERC20Min
 * @notice Minimal IERC20 for approve/transferFrom/balanceOf on plaintext USDC + aUSDC.
 *         Kept local to avoid pulling OpenZeppelin's full interface.
 */
interface IERC20Min {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}
