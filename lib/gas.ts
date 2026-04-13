import type { PublicClient } from "viem";

/**
 * Fetch fresh EIP-1559 fees with a 20% buffer.
 * MetaMask under-estimates gas on Arbitrum Sepolia, so we must override.
 */
export async function estimateGasOverrides(publicClient: PublicClient | undefined) {
  if (!publicClient) return {};
  const fees = await publicClient.estimateFeesPerGas();
  return {
    maxFeePerGas: (fees.maxFeePerGas * 120n) / 100n,
    maxPriorityFeePerGas: (fees.maxPriorityFeePerGas * 120n) / 100n,
  };
}
