"use client";

import { useReadContracts } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";

export interface FundYield {
  /** Plaintext USDC principal currently supplied to Aave on this fund's behalf (6 decimals) */
  principal: bigint;
  /** Current aUSDC value attributable to this fund (6 decimals) */
  aValue: bigint;
  /** aValue - principal (can be negative only if principal underflows; signed) */
  yieldAmount: bigint;
  /** Current Aave USDC supply APY in basis points */
  apyBps: bigint;
}

const vaultAddress = ("SHADOW_FUND_VAULT" in CONTRACTS)
  ? (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT
  : undefined;

/**
 * Reads per-fund Aave yield state in a single multicall-friendly batch.
 */
export function useFundYield(fundId: bigint | undefined) {
  const enabled = !!vaultAddress && fundId !== undefined;

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "getFundPrincipal",
        args: [fundId ?? 0n],
      },
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "getFundAValue",
        args: [fundId ?? 0n],
      },
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "getFundYield",
        args: [fundId ?? 0n],
      },
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "getCurrentAaveApyBps",
      },
    ],
    query: {
      enabled,
      refetchInterval: 10_000,
    },
  });

  if (!data || !enabled) return { fundYield: null as FundYield | null, isLoading, refetch };

  const [principalR, aValueR, yieldR, apyR] = data;
  if (
    principalR.status !== "success" ||
    aValueR.status !== "success" ||
    yieldR.status !== "success" ||
    apyR.status !== "success"
  ) {
    return { fundYield: null, isLoading, refetch };
  }

  const fundYield: FundYield = {
    principal: principalR.result as bigint,
    aValue: aValueR.result as bigint,
    yieldAmount: yieldR.result as bigint,
    apyBps: apyR.result as bigint,
  };

  return { fundYield, isLoading, refetch };
}
