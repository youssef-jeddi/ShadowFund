/**
 * Redeploy ShadowFund meta-vault to Arbitrum Sepolia.
 *
 * The two sub-vaults (AaveUSDCVault, FixedYieldVault) persist across redeploys
 * and are reused at their existing addresses. FixedYieldVault already holds the
 * 500 USDC reward pool seeded in the prior deploy — no re-seed required.
 *
 * Sequence:
 *   1. ShadowFundVault(cUSDC, [AaveUSDCVault, FixedYieldVault])
 *
 * If REDEPLOY_SUBVAULTS=1, also redeploy AaveUSDCVault + FixedYieldVault and
 * re-seed the reward pool (tune with FIXED_POOL_AMOUNT, default 500 USDC).
 *
 * Usage:
 *   npm run deploy:arb
 */

import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Existing cUSDC (iExec Nox demo, do not redeploy) ───────────────────────
const CUSDC_ADDRESS = "0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e";

// ── Aave reserve addresses (verified by scripts/check-aave.ts) ─────────────
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

// ── Sub-vault addresses from prior deploy (reused unless REDEPLOY_SUBVAULTS=1) ──
const EXISTING_AAVE_USDC_VAULT   = "0xfff39C5BCEf87623De00630bD9DB7bf5Be981546";
const EXISTING_FIXED_YIELD_VAULT = "0xcaE8150313B69d4f8E0400fe1b4DB1022c08348d";

// ── Seed default for FixedYieldVault reward pool (only used on full redeploy) ──
const FIXED_POOL_AMOUNT = process.env.FIXED_POOL_AMOUNT
  ? BigInt(process.env.FIXED_POOL_AMOUNT)
  : 500_000000n;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

async function tryVerify(address: string, args: unknown[], label: string) {
  if (network.name !== "arbitrumSepolia") return;
  try {
    await run("verify:verify", { address, constructorArguments: args });
    console.log(`   ${label} verified ✓`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`   ${label} verify skipped: ${msg}`);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying with: ${deployer.address}`);
  console.log(`Network: ${network.name} (chainId: ${network.config.chainId})\n`);

  const redeploySubvaults = process.env.REDEPLOY_SUBVAULTS === "1";

  let aaveUsdcAddress: string;
  let fixedAddress: string;

  if (redeploySubvaults) {
    console.log("REDEPLOY_SUBVAULTS=1 — deploying fresh sub-vaults.\n");

    console.log("1/3 Deploying AaveUSDCVault...");
    const AaveUSDCVault = await ethers.getContractFactory("AaveUSDCVault");
    const aaveUsdc = await AaveUSDCVault.deploy();
    await aaveUsdc.waitForDeployment();
    aaveUsdcAddress = await aaveUsdc.getAddress();
    console.log(`   AaveUSDCVault → ${aaveUsdcAddress}`);

    console.log("2/3 Deploying FixedYieldVault...");
    const FixedYieldVault = await ethers.getContractFactory("FixedYieldVault");
    const fixed = await FixedYieldVault.deploy();
    await fixed.waitForDeployment();
    fixedAddress = await fixed.getAddress();
    console.log(`   FixedYieldVault → ${fixedAddress}`);

    // Seed the reward pool
    try {
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, deployer);
      const usdcBal: bigint = await usdc.balanceOf(deployer.address);
      if (usdcBal >= FIXED_POOL_AMOUNT) {
        const approveTx = await usdc.approve(fixedAddress, FIXED_POOL_AMOUNT);
        await approveTx.wait();
        const fundTx = await fixed.fundRewardPool(FIXED_POOL_AMOUNT);
        await fundTx.wait();
        console.log(
          `   FixedYieldVault reward pool funded with ${FIXED_POOL_AMOUNT / 1_000000n} USDC`
        );
      } else {
        console.warn(
          `   ⚠️  Skipping reward pool: deployer has ${usdcBal / 1_000000n} USDC, needs ${FIXED_POOL_AMOUNT / 1_000000n}`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`   ⚠️  Reward pool seed failed: ${msg}`);
    }
  } else {
    console.log("Reusing existing sub-vaults (set REDEPLOY_SUBVAULTS=1 to redeploy).");
    aaveUsdcAddress = EXISTING_AAVE_USDC_VAULT;
    fixedAddress = EXISTING_FIXED_YIELD_VAULT;
    console.log(`   AaveUSDCVault   → ${aaveUsdcAddress}`);
    console.log(`   FixedYieldVault → ${fixedAddress}`);
  }

  // Deploy ShadowFundVault with 2-sub-vault tuple
  console.log(`\n${redeploySubvaults ? "3/3" : "1/1"} Deploying ShadowFundVault...`);
  const ShadowFundVault = await ethers.getContractFactory("ShadowFundVault");
  const approvedVaults: [string, string] = [aaveUsdcAddress, fixedAddress];
  const vault = await ShadowFundVault.deploy(CUSDC_ADDRESS, approvedVaults);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ShadowFundVault → ${vaultAddress}`);

  // ── Persist ─────────────────────────────────────────────────────────────
  const deployBlock = await ethers.provider.getBlockNumber();
  const deployment = {
    network: network.name,
    chainId: network.config.chainId,
    deployBlock,
    deployedAt: new Date().toISOString(),
    contracts: {
      AaveUSDCVault: aaveUsdcAddress,
      FixedYieldVault: fixedAddress,
      ShadowFundVault: vaultAddress,
    },
    inputs: {
      cUSDC: CUSDC_ADDRESS,
      approvedVaults,
    },
  };

  const outPath = path.join(__dirname, "../deployments/arbitrumSepolia.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment info saved → ${outPath}`);

  // ── Verify ──────────────────────────────────────────────────────────────
  if (network.name === "arbitrumSepolia") {
    console.log("\nVerifying contracts on Arbiscan...");
    if (redeploySubvaults) {
      await tryVerify(aaveUsdcAddress, [], "AaveUSDCVault");
      await tryVerify(fixedAddress, [], "FixedYieldVault");
    }
    await tryVerify(
      vaultAddress,
      [CUSDC_ADDRESS, approvedVaults],
      "ShadowFundVault"
    );
  }

  console.log("\nDeploy complete. Run `npm run export-abi` to update the frontend.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
