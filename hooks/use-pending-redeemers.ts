"use client";

import { useEffect, useState, useCallback } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";

type Address = `0x${string}`;

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as Address;

/**
 * Enumerates users who currently have a pending redeem on a given fund.
 *
 * The contract does not track pending redeemers in an enumerable set, so we
 * scan `RedeemRequested` events for candidates, then confirm each candidate
 * via `hasPendingRedeem(fundId, user)` (events never get un-emitted after
 * `processRedeem` / `_autoRedeem`, so the on-chain check is required).
 */
export function usePendingRedeemers(fundId: bigint | undefined) {
  const publicClient = usePublicClient();
  const [candidates, setCandidates] = useState<Address[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    if (!publicClient || fundId === undefined) return;
    setScanLoading(true);
    setScanError(null);
    try {
      const logs = await publicClient.getContractEvents({
        address: vaultAddress,
        abi: shadowFundVaultAbi,
        eventName: "RedeemRequested",
        args: { fundId },
        fromBlock: 0n,
      });
      const seen = new Set<Address>();
      for (const log of logs) {
        const user = log.args.user as Address | undefined;
        if (user) seen.add(user);
      }
      setCandidates([...seen]);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Log scan failed");
    } finally {
      setScanLoading(false);
    }
  }, [publicClient, fundId]);

  useEffect(() => {
    scan();
  }, [scan]);

  const { data: flagsData, isLoading: flagsLoading } = useReadContracts({
    contracts: candidates.map((user) => ({
      address: vaultAddress,
      abi: shadowFundVaultAbi,
      functionName: "hasPendingRedeem" as const,
      args: [fundId ?? 0n, user] as const,
    })),
    query: {
      enabled: fundId !== undefined && candidates.length > 0,
      refetchInterval: 15_000,
    },
  });

  const pending: Address[] = candidates.filter(
    (_, i) => flagsData?.[i]?.status === "success" && flagsData[i].result === true,
  );

  return {
    pending,
    isLoading: scanLoading || flagsLoading,
    error: scanError,
    refetch: scan,
  };
}
