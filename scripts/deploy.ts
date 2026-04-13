/**
 * Deploy ShadowFund contracts to Arbitrum Sepolia.
 *
 * Usage:
 *   npm run deploy:arb
 *   # or directly:
 *   hardhat run scripts/deploy.ts --network arbitrumSepolia --config hardhat.config.ts
 *
 * IMPORTANT: Verify Chainlink feed addresses at chain.link/data-feeds before running.
 * Testnet feeds occasionally migrate.
 *
 * After deploy, run `npm run export-abi` to update lib/shadow-fund-abi.ts and
 * lib/contracts.ts with the deployed addresses.
 */

import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Chainlink feed addresses (Arbitrum Sepolia) ────────────────────────────
const CHAINLINK_FEEDS = {
  ETH_USD:  "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
  BTC_USD:  "0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69",
  LINK_USD: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
};

// ── Existing cUSDC address (from iExec Nox demo, do not redeploy) ──────────
const CUSDC_ADDRESS = "0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying with: ${deployer.address}`);
  console.log(`Network: ${network.name} (chainId: ${network.config.chainId})\n`);

  // 1. Deploy PriceOracle
  console.log("1/2 Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const oracle = await PriceOracle.deploy(
    CHAINLINK_FEEDS.ETH_USD,
    CHAINLINK_FEEDS.BTC_USD,
    CHAINLINK_FEEDS.LINK_USD,
  );
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log(`   PriceOracle deployed → ${oracleAddress}`);

  // 2. Deploy ShadowFundVault
  console.log("2/2 Deploying ShadowFundVault...");
  const ShadowFundVault = await ethers.getContractFactory("ShadowFundVault");
  const vault = await ShadowFundVault.deploy(CUSDC_ADDRESS, oracleAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ShadowFundVault deployed → ${vaultAddress}`);

  // 3. Persist addresses
  const deployBlock = await ethers.provider.getBlockNumber();
  const deployment = {
    network: network.name,
    chainId: network.config.chainId,
    deployBlock,
    deployedAt: new Date().toISOString(),
    contracts: {
      PriceOracle: oracleAddress,
      ShadowFundVault: vaultAddress,
    },
    inputs: {
      cUSDC: CUSDC_ADDRESS,
      chainlinkFeeds: CHAINLINK_FEEDS,
    },
  };

  const outPath = path.join(__dirname, "../deployments/arbitrumSepolia.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment info saved → ${outPath}`);

  // 4. Verify on Arbiscan (may fail on first run if propagation is slow — rerun with `npm run verify:arb`)
  if (network.name === "arbitrumSepolia") {
    console.log("\nVerifying contracts on Arbiscan...");
    try {
      await run("verify:verify", {
        address: oracleAddress,
        constructorArguments: [
          CHAINLINK_FEEDS.ETH_USD,
          CHAINLINK_FEEDS.BTC_USD,
          CHAINLINK_FEEDS.LINK_USD,
        ],
      });
      console.log("   PriceOracle verified ✓");
    } catch (e: any) {
      console.warn("   PriceOracle verify skipped:", e.message);
    }

    try {
      await run("verify:verify", {
        address: vaultAddress,
        constructorArguments: [CUSDC_ADDRESS, oracleAddress],
      });
      console.log("   ShadowFundVault verified ✓");
    } catch (e: any) {
      console.warn("   ShadowFundVault verify skipped:", e.message);
    }
  }

  console.log("\nDeploy complete. Run `npm run export-abi` to update the frontend.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
