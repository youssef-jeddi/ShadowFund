"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";

export interface FundMetadata {
  fundId: bigint;
  manager: `0x${string}`;
  name: string;
  description: string;
  createdAt: bigint;
  performanceFeeBps: bigint;
  revealed: boolean;
  strategySet: boolean;
  depositorCount: bigint;
  shareFacade: `0x${string}`;
}

const vaultAddress = ("SHADOW_FUND_VAULT" in CONTRACTS)
  ? (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT
  : undefined;

/**
 * Returns all funds from the vault, fetched via multicall.
 * Polls every 30 seconds to pick up new funds.
 */
export function useFundList() {
  // First, get the total number of funds
  const { data: nextFundId, isLoading: loadingCount } = useReadContract({
    address: vaultAddress,
    abi: shadowFundVaultAbi,
    functionName: "nextFundId",
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 30_000,
    },
  });

  const count = nextFundId ? Number(nextFundId) : 0;

  // Batch-read metadata for all funds
  const { data: rawMetadata, isLoading: loadingMeta } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: vaultAddress as `0x${string}`,
      abi: shadowFundVaultAbi,
      functionName: "getFundMetadata" as const,
      args: [BigInt(i)] as const,
    })),
    query: {
      enabled: !!vaultAddress && count > 0,
      refetchInterval: 30_000,
    },
  });

  const funds: FundMetadata[] = [];

  if (rawMetadata) {
    rawMetadata.forEach((result, index) => {
      if (result.status === "success" && result.result) {
        const [
          manager,
          name,
          description,
          createdAt,
          performanceFeeBps,
          revealed,
          strategySet,
          depositorCount,
          shareFacade,
        ] = result.result as [
          `0x${string}`, string, string,
          bigint, bigint, boolean, boolean, bigint, `0x${string}`
        ];
        funds.push({
          fundId: BigInt(index),
          manager,
          name,
          description,
          createdAt,
          performanceFeeBps,
          revealed,
          strategySet,
          depositorCount,
          shareFacade,
        });
      }
    });
  }

  return {
    funds,
    isLoading: loadingCount || loadingMeta,
    count,
  };
}
