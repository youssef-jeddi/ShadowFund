"use client";

import { useReadContracts } from "wagmi";
import { shadowFundVaultAbi, subVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";

export type Pair = [bigint, bigint];

export interface SubVaultMetrics {
  /** APY basis points for each sub-vault — [Aave USDC, Fixed]. */
  apys: [number, number];
  /** Raw sub-vault share balances the fund currently holds. */
  shares: Pair;
  /** USDC-equivalent value of those shares (convertToAssets). */
  values: Pair;
  /** Sum of `values`. */
  totalDeployed: bigint;
}

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;
const subVaultAddresses: [`0x${string}`, `0x${string}`] = [
  CONTRACTS.AAVE_USDC_VAULT as `0x${string}`,
  CONTRACTS.FIXED_YIELD_VAULT as `0x${string}`,
];

/**
 * Per-fund multicall over the 2 sub-vaults:
 *   - getSubVaultAPYs          → APY[2] (live)
 *   - getSubVaultShares(fund)  → share[2] held by fund
 *   - convertToAssets(share)   → USDC value[2]
 */
export function useSubVaultMetrics(fundId: bigint | undefined) {
  const enabled = !!vaultAddress && fundId !== undefined;

  const { data: phase1 } = useReadContracts({
    contracts: [
      {
        address: vaultAddress,
        abi: shadowFundVaultAbi,
        functionName: "getSubVaultAPYs",
      },
      {
        address: vaultAddress,
        abi: shadowFundVaultAbi,
        functionName: "getSubVaultShares",
        args: [fundId ?? 0n],
      },
    ],
    query: {
      enabled,
      refetchInterval: 10_000,
    },
  });

  const apysR = phase1?.[0];
  const sharesR = phase1?.[1];

  const apys: [number, number] =
    apysR?.status === "success" && apysR.result
      ? (() => {
          const t = apysR.result as readonly bigint[];
          return [Number(t[0]), Number(t[1])];
        })()
      : [0, 0];

  const shares: Pair =
    sharesR?.status === "success" && sharesR.result
      ? (() => {
          const t = sharesR.result as readonly bigint[];
          return [t[0], t[1]];
        })()
      : [0n, 0n];

  const { data: phase2 } = useReadContracts({
    contracts: [
      {
        address: subVaultAddresses[0],
        abi: subVaultAbi,
        functionName: "convertToAssets",
        args: [shares[0]],
      },
      {
        address: subVaultAddresses[1],
        abi: subVaultAbi,
        functionName: "convertToAssets",
        args: [shares[1]],
      },
    ],
    query: {
      enabled: enabled && (shares[0] > 0n || shares[1] > 0n),
      refetchInterval: 10_000,
    },
  });

  const values: Pair = [
    phase2?.[0]?.status === "success" ? (phase2[0].result as bigint) : 0n,
    phase2?.[1]?.status === "success" ? (phase2[1].result as bigint) : 0n,
  ];

  const totalDeployed = values[0] + values[1];

  const metrics: SubVaultMetrics = {
    apys,
    shares,
    values,
    totalDeployed,
  };

  return { metrics, isLoading: !phase1, subVaultAddresses };
}
