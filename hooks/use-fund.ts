"use client";

import { useReadContracts } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import type { FundMetadata } from "@/hooks/use-fund-list";

export interface FundDetail extends FundMetadata {
  revealedStrategy: {
    wethBps: number;
    usdcBps: number;
  } | null;
  performanceScoreBps: number | null;
  startPriceEth: bigint | null;
}

const vaultAddress = ("SHADOW_FUND_VAULT" in CONTRACTS)
  ? (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT
  : undefined;

/**
 * Fetches all data for a single fund by ID.
 * Includes metadata, revealed strategy (if any), and performance score.
 */
export function useFund(fundId: bigint | undefined) {
  const enabled = !!vaultAddress && fundId !== undefined;

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "getFundMetadata",
        args: [fundId ?? 0n],
      },
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "getRevealedStrategy",
        args: [fundId ?? 0n],
      },
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "getPerformanceScoreBps",
        args: [fundId ?? 0n],
      },
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "getStartPriceEth",
        args: [fundId ?? 0n],
      },
    ],
    query: {
      enabled,
      refetchInterval: 15_000,
    },
  });

  if (!data || !enabled) return { fund: null, isLoading, refetch };

  const [metaResult, stratResult, scoreResult, startPriceResult] = data;

  if (metaResult.status !== "success" || !metaResult.result) {
    return { fund: null, isLoading, refetch };
  }

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
  ] = metaResult.result as [
    `0x${string}`, string, string,
    bigint, bigint, boolean, boolean, bigint, `0x${string}`
  ];

  const revealedStrategy =
    revealed && stratResult.status === "success" && stratResult.result
      ? (() => {
          const [wethBps, usdcBps] = stratResult.result as [bigint, bigint];
          return {
            wethBps: Number(wethBps),
            usdcBps: Number(usdcBps),
          };
        })()
      : null;

  const performanceScoreBps =
    revealed && scoreResult.status === "success" && scoreResult.result !== undefined
      ? Number(scoreResult.result as bigint)
      : null;

  const startPriceEth =
    startPriceResult.status === "success" && startPriceResult.result !== undefined
      ? (startPriceResult.result as bigint)
      : null;

  const fund: FundDetail = {
    fundId: fundId!,
    manager,
    name,
    description,
    createdAt,
    performanceFeeBps,
    revealed,
    strategySet,
    depositorCount,
    shareFacade,
    revealedStrategy,
    performanceScoreBps,
    startPriceEth,
  };

  return { fund, isLoading, refetch };
}
