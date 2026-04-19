/**
 * Contract addresses — Arbitrum Sepolia (chainId: 421614)
 *
 * Single source of truth for all deployed contract addresses.
 * Update this file when contracts are redeployed.
 */

export const CONTRACTS = {
  /** Testnet USDC (ERC-20, decimals: 6) */
  USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  /** Confidential USDC (ERC-7984, decimals: 6) */
  cUSDC: "0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e",
  /** iExec RLC (ERC-20, decimals: 9) */
  RLC: "0x9923eD3cbd90CD78b910c475f9A731A6e0b8C963",
  /** Confidential RLC (ERC-7984, decimals: 9) */
  cRLC: "0x92b23f4a59175415ced5cb37e64a1fc6a9d79af4",
  /** NoxCompute proxy — addViewer / isViewer */
  NOX_COMPUTE: "0xd464B198f06756a1d00be223634b85E0a731c229",

  /** AaveUSDCVault — sub-vault supplying USDC to Aave v3 */
  AAVE_USDC_VAULT: "0xfff39C5BCEf87623De00630bD9DB7bf5Be981546",
  /** FixedYieldVault — sub-vault accruing fixed 8% APY from reward pool */
  FIXED_YIELD_VAULT: "0xcaE8150313B69d4f8E0400fe1b4DB1022c08348d",
  /** ShadowFundVault — meta-vault allocating across the 2 sub-vaults */
  SHADOW_FUND_VAULT: "0x29C154427Bb65263A0aF43aAfa7b32c998e6d241",
} as const;

/** Null address — used to filter native tokens (ETH) in contract calls */
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

/** Null handle (bytes32) — indicates an uninitialized confidential balance */
export const ZERO_HANDLE = ("0x" + "0".repeat(64)) as `0x${string}`;
