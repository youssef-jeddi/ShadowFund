"use client";

import { useReadContracts } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import type { FundMetadata, AllocationPair } from "@/hooks/use-fund-list";

export type { AllocationPair };

export interface FundDetail extends FundMetadata {
  totalDeployed: bigint;
}

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

/**
 * Fetches all data for a single fund by ID.
 */
export function useFund(fundId: bigint | undefined) {
  const enabled = !!vaultAddress && fundId !== undefined;

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: vaultAddress,
        abi: shadowFundVaultAbi,
        functionName: "getFundMetadata",
        args: [fundId ?? 0n],
      },
      {
        address: vaultAddress,
        abi: shadowFundVaultAbi,
        functionName: "getAllocation",
        args: [fundId ?? 0n],
      },
      {
        address: vaultAddress,
        abi: shadowFundVaultAbi,
        functionName: "getFundTotalDeployed",
        args: [fundId ?? 0n],
      },
    ],
    query: {
      enabled,
      refetchInterval: 15_000,
    },
  });

  if (!data || !enabled) return { fund: null, isLoading, refetch };

  const [metaR, allocR, deployedR] = data;

  if (metaR.status !== "success" || !metaR.result) {
    return { fund: null, isLoading, refetch };
  }

  const [
    manager,
    name,
    description,
    createdAt,
    performanceFeeBps,
    allocationSet,
    depositorCount,
    shareFacade,
  ] = metaR.result as [
    `0x${string}`, string, string, bigint, bigint, boolean, bigint, `0x${string}`
  ];

  const allocationBps: AllocationPair =
    allocR.status === "success" && allocR.result
      ? (() => {
          const tuple = allocR.result as readonly bigint[];
          return [Number(tuple[0]), Number(tuple[1])];
        })()
      : [0, 0];

  const totalDeployed =
    deployedR.status === "success" && deployedR.result !== undefined
      ? (deployedR.result as bigint)
      : 0n;

  const fund: FundDetail = {
    fundId: fundId!,
    manager,
    name,
    description,
    createdAt,
    performanceFeeBps,
    allocationSet,
    depositorCount,
    shareFacade,
    allocationBps,
    totalDeployed,
  };

  return { fund, isLoading, refetch };
}
