/**
 * Pre-flight gate for the Aave v3 integration.
 *
 * Reads the USDC reserve from Aave v3's Arb Sepolia deployment and asserts the
 * reserve is active (liquidityRate > 0 AND aToken address set). Also discovers
 * the canonical aUSDC address — the vault uses whatever this script prints, not
 * any hardcoded brief value.
 *
 * Addresses sourced from bgd-labs/aave-address-book (AaveV3ArbitrumSepolia).
 *
 * Run: npx hardhat run scripts/check-aave.ts --network arbitrumSepolia
 */

import { ethers } from "hardhat";
import type { Contract } from "ethers";

const AAVE = {
  POOL:              "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff",
  POOL_DATA_PROVIDER:"0x12373B5085e3b42D42C1D4ABF3B3Cf4Df0E0Fa01",
  USDC:              "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
};

const RAY = 10n ** 27n;

const DATA_PROVIDER_ABI = [
  "function getReserveData(address asset) external view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)",
  "function getReserveTokensAddresses(address asset) external view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
  "function getAllReservesTokens() external view returns (tuple(string symbol, address tokenAddress)[])",
];

interface ReserveSummary {
  symbol: string;
  asset: string;
  aToken: string;
  liquidityRate: bigint;
  apyBps: bigint;
  totalAToken: bigint;
}

async function checkReserve(
  dataProvider: Contract,
  symbol: string,
  asset: string,
): Promise<ReserveSummary> {
  let data;
  try {
    data = await dataProvider.getReserveData(asset);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${symbol}: getReserveData reverted — ${msg}`);
  }

  const totalAToken = (data.totalAToken ?? data[2]) as bigint;
  const liquidityRate = (data.liquidityRate ?? data[5]) as bigint;

  const tokens = await dataProvider.getReserveTokensAddresses(asset);
  const aToken = (tokens.aTokenAddress ?? tokens[0]) as string;

  if (liquidityRate === 0n) {
    throw new Error(`${symbol}: liquidityRate is 0 — reserve not accruing interest`);
  }
  if (aToken === ethers.ZeroAddress) {
    throw new Error(`${symbol}: aToken address is zero — reserve not initialised`);
  }

  const apyBps = (liquidityRate * 10000n) / RAY;

  return { symbol, asset, aToken, liquidityRate, apyBps, totalAToken };
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`\nChecking Aave v3 on Arb Sepolia (caller: ${signer.address})\n`);

  const dataProvider = new ethers.Contract(
    AAVE.POOL_DATA_PROVIDER,
    DATA_PROVIDER_ABI,
    signer,
  ) as unknown as Contract;

  // Discover available reserves first — brief's USDC address may be stale.
  try {
    const all = await dataProvider.getAllReservesTokens();
    console.log("  All Aave reserves on Arb Sepolia:");
    for (const r of all) {
      const sym = r.symbol ?? r[0];
      const addr = r.tokenAddress ?? r[1];
      console.log(`    ${sym.padEnd(10)} ${addr}`);
    }
    console.log();

    // Locate USDC dynamically — override hardcoded value if different.
    for (const r of all) {
      const sym = (r.symbol ?? r[0]) as string;
      const addr = (r.tokenAddress ?? r[1]) as string;
      if (sym === "USDC" && addr.toLowerCase() !== AAVE.USDC.toLowerCase()) {
        console.log(`  NOTE: Discovered USDC address ${addr} differs from hardcoded ${AAVE.USDC} — using discovered value.`);
        AAVE.USDC = addr;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\nFAIL: getAllReservesTokens reverted: ${msg}`);
    process.exit(1);
  }

  const targets = [{ symbol: "USDC", asset: AAVE.USDC }];

  const results: ReserveSummary[] = [];
  for (const t of targets) {
    try {
      const r = await checkReserve(dataProvider, t.symbol, t.asset);
      results.push(r);
      console.log(`  ${t.symbol} OK`);
      console.log(`    asset               : ${r.asset}`);
      console.log(`    aToken              : ${r.aToken}`);
      console.log(`    totalAToken         : ${r.totalAToken}`);
      console.log(`    liquidityRate (RAY) : ${r.liquidityRate}`);
      console.log(`    APY                 : ${r.apyBps} bps (${Number(r.apyBps) / 100}%)\n`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`\nFAIL: ${msg}`);
      process.exit(1);
    }
  }

  console.log("PASS: Aave v3 USDC reserve is active on Arb Sepolia.");
  console.log("\nUse these addresses in AaveAddresses.sol:");
  for (const r of results) {
    console.log(`  a${r.symbol} = ${r.aToken}`);
  }
  console.log(`  USDC = ${AAVE.USDC}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
