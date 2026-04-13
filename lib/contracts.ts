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

  /** ShadowFund price oracle (Chainlink wrapper for ETH/BTC/LINK) */
  PRICE_ORACLE: "0x847DA272D6Ec47206e23C17EdBb84859dAB2EbE4",
  /** ShadowFundVault — main confidential vault contract */
  SHADOW_FUND_VAULT: "0x46012F653755Da1B082Ab0161821b8A7e383e7E2",
} as const;

/** Null address — used to filter native tokens (ETH) in contract calls */
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

/** Null handle (bytes32) — indicates an uninitialized confidential balance */
export const ZERO_HANDLE = ("0x" + "0".repeat(64)) as `0x${string}`;
