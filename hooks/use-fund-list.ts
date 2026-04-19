"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";

export type AllocationPair = [number, number];

export interface FundMetadata {
  fundId: bigint;
  manager: `0x${string}`;
  name: string;
  description: string;
  createdAt: bigint;
  performanceFeeBps: bigint;
  allocationSet: boolean;
  depositorCount: bigint;
  shareFacade: `0x${string}`;
  allocationBps: AllocationPair;
}

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

/**
 * Returns all funds from the vault, fetched via multicall.
 * Polls every 30 seconds to pick up new funds.
 */
export function useFundList() {
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

  const { data: rawMetadata, isLoading: loadingMeta } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => [
      {
        address: vaultAddress,
        abi: shadowFundVaultAbi,
        functionName: "getFundMetadata" as const,
        args: [BigInt(i)] as const,
      },
      {
        address: vaultAddress,
        abi: shadowFundVaultAbi,
        functionName: "getAllocation" as const,
        args: [BigInt(i)] as const,
      },
    ]).flat(),
    query: {
      enabled: !!vaultAddress && count > 0,
      refetchInterval: 30_000,
    },
  });

  const funds: FundMetadata[] = [];

  if (rawMetadata) {
    for (let index = 0; index < count; index++) {
      const metaResult = rawMetadata[index * 2];
      const allocResult = rawMetadata[index * 2 + 1];

      if (metaResult?.status !== "success" || !metaResult.result) continue;

      const [
        manager,
        name,
        description,
        createdAt,
        performanceFeeBps,
        allocationSet,
        depositorCount,
        shareFacade,
      ] = metaResult.result as [
        `0x${string}`, string, string, bigint, bigint, boolean, bigint, `0x${string}`
      ];

      const allocationBps: AllocationPair =
        allocResult?.status === "success" && allocResult.result
          ? (() => {
              const tuple = allocResult.result as readonly bigint[];
              return [Number(tuple[0]), Number(tuple[1])];
            })()
          : [0, 0];

      funds.push({
        fundId: BigInt(index),
        manager,
        name,
        description,
        createdAt,
        performanceFeeBps,
        allocationSet,
        depositorCount,
        shareFacade,
        allocationBps,
      });
    }
  }

  return {
    funds,
    isLoading: loadingCount || loadingMeta,
    count,
  };
}
