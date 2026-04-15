// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title AaveAddresses
 * @notice Canonical Aave v3 addresses for Arbitrum Sepolia (chainId 421614).
 *         Sourced from bgd-labs/aave-address-book (AaveV3ArbitrumSepolia) and
 *         verified on-chain via scripts/check-aave.ts.
 *
 *         USDC reserve is active — liquidityRate > 0, aUSDC initialised.
 *         Last verified APY: ~4.26% (2025-era liquidity).
 */
library AaveAddresses {
    // Core protocol
    address internal constant POOL                = 0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff;
    address internal constant POOL_DATA_PROVIDER  = 0x12373B5085e3b42D42C1D4ABF3B3Cf4Df0E0Fa01;

    // Tokens
    address internal constant USDC  = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address internal constant AUSDC = 0x460b97BD498E1157530AEb3086301d5225b91216;
    address internal constant WETH  = 0x980B62Da83eFf3D4576C647993b0c1D7faf17c73;
}
