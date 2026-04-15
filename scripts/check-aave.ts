/**
 * Pre-flight gate for the Aave v3 integration.
 *
 * Reads the USDC reserve data from Aave v3's Arb Sepolia deployment and
 * asserts the reserve is active (liquidityRate > 0 AND aToken address set).
 *
 * Addresses sourced from bgd-labs/aave-address-book (AaveV3ArbitrumSepolia).
 *
 * Run: TS_NODE_PROJECT=tsconfig.hardhat.json hardhat run scripts/check-aave.ts --network arbitrumSepolia --config hardhat.config.ts
 */

import { ethers } from "hardhat";

const AAVE = {
  POOL:              "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff",
  POOL_DATA_PROVIDER:"0x12373B5085e3b42D42C1D4ABF3B3Cf4Df0E0Fa01",
  USDC:              "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  WETH:              "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
};

const RAY = 10n ** 27n;

const DATA_PROVIDER_ABI = [
  "function getReserveData(address asset) external view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)",
  "function getReserveTokensAddresses(address asset) external view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
];

const POOL_ABI = [
  "function getReserveData(address asset) external view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`\nChecking Aave v3 on Arb Sepolia (caller: ${signer.address})\n`);

  const dataProvider = new ethers.Contract(
    AAVE.POOL_DATA_PROVIDER,
    DATA_PROVIDER_ABI,
    signer,
  );

  let liquidityRate: bigint;
  try {
    const data = await dataProvider.getReserveData(AAVE.USDC);
    liquidityRate = data.liquidityRate ?? data[5];
    console.log(`  DataProvider.getReserveData(USDC) OK`);
    console.log(`    totalAToken         : ${data.totalAToken ?? data[2]}`);
    console.log(`    liquidityRate (RAY) : ${liquidityRate}`);
  } catch (e: any) {
    console.error(`\nFAIL: DataProvider.getReserveData reverted: ${e.message}`);
    console.error("       Aave v3 may not be active on Arb Sepolia at the expected addresses.");
    process.exit(1);
  }

  const tokens = await dataProvider.getReserveTokensAddresses(AAVE.USDC);
  const aToken = tokens.aTokenAddress ?? tokens[0];
  console.log(`    aUSDC address       : ${aToken}`);

  const pool = new ethers.Contract(AAVE.POOL, POOL_ABI, signer);
  const reserve = await pool.getReserveData(AAVE.USDC);
  console.log(`  Pool.getReserveData(USDC) OK`);
  console.log(`    currentLiquidityRate: ${reserve.currentLiquidityRate}`);
  console.log(`    aTokenAddress       : ${reserve.aTokenAddress}`);

  // Compute APY in bps (liquidity rate is per-second in RAY; for display just
  // treat it as an annualised RAY rate, which is how Aave documents it).
  const apyBps = (liquidityRate * 10000n) / RAY;
  console.log(`\n  Estimated USDC supply APY: ${apyBps} bps (${Number(apyBps) / 100}%)`);

  if (liquidityRate === 0n) {
    console.error("\nFAIL: liquidityRate is 0. The USDC reserve is not accruing interest.");
    process.exit(1);
  }

  if (aToken === ethers.ZeroAddress) {
    console.error("\nFAIL: aToken address is zero. Reserve not initialised.");
    process.exit(1);
  }

  console.log("\nPASS: Aave v3 USDC reserve is active on Arb Sepolia.");
  console.log(`      Use aUSDC = ${aToken} in the vault.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
