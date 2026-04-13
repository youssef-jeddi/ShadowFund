"use client";

import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { noxComputeAbi, NOX_COMPUTE_ADDRESS } from "@/lib/nox-compute-abi";
import { confidentialTokenAbi } from "@/lib/confidential-token-abi";
import { CONTRACTS, ZERO_HANDLE } from "@/lib/contracts";
import type { DelegatedViewEntry, TokenInfo } from "@/lib/delegated-view";
import type { PublicClient } from "viem";

const TOKEN_PAIRS = [
  { cToken: CONTRACTS.cRLC as `0x${string}`, symbol: "cRLC", decimals: 9 },
  { cToken: CONTRACTS.cUSDC as `0x${string}`, symbol: "cUSDC", decimals: 6 },
] as const;

// ── Helpers ────────────────────────────────────────────────────────

async function fetchBlockTimestamps(
  publicClient: PublicClient,
  blockNumbers: bigint[],
): Promise<Map<bigint, number>> {
  const unique = [...new Set(blockNumbers.map(String))].map(BigInt);
  const entries = await Promise.all(
    unique.map(async (bn) => {
      const block = await publicClient.getBlock({ blockNumber: bn });
      return [bn, Number(block.timestamp)] as const;
    }),
  );
  return new Map(entries);
}

/**
 * For each address × cToken, read `confidentialBalanceOf` to get the current
 * handle. This lets us: (1) identify which token a handle belongs to, and
 * (2) determine if the grant is still active (handle == current balance handle).
 */
async function buildHandleTokenMap(
  publicClient: PublicClient,
  addresses: Set<`0x${string}`>,
): Promise<Map<string, TokenInfo>> {
  const map = new Map<string, TokenInfo>();
  await Promise.all(
    [...addresses].flatMap((addr) =>
      TOKEN_PAIRS.map(async (pair) => {
        try {
          const handle = await publicClient.readContract({
            address: pair.cToken,
            abi: confidentialTokenAbi,
            functionName: "confidentialBalanceOf",
            args: [addr],
          });
          if (handle && handle !== ZERO_HANDLE) {
            map.set((handle as string).toLowerCase(), {
              symbol: pair.symbol,
              decimals: pair.decimals,
            });
          }
        } catch {
          // Contract call failed — skip
        }
      }),
    ),
  );
  return map;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useDelegatedView() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ["delegated-view", address],
    queryFn: async () => {
      if (!address || !publicClient)
        return { sharedWithMe: [], myGrants: [] };

      // 1. Fetch ViewerAdded events (sender = me / viewer = me)
      const [myGrantsLogs, sharedLogs] = await Promise.all([
        publicClient.getContractEvents({
          address: NOX_COMPUTE_ADDRESS as `0x${string}`,
          abi: noxComputeAbi,
          eventName: "ViewerAdded",
          args: { sender: address },
          fromBlock: 0n,
        }),
        publicClient.getContractEvents({
          address: NOX_COMPUTE_ADDRESS as `0x${string}`,
          abi: noxComputeAbi,
          eventName: "ViewerAdded",
          args: { viewer: address },
          fromBlock: 0n,
        }),
      ]);

      // 2. Collect addresses for handle→token resolution
      const addressesToCheck = new Set<`0x${string}`>();
      addressesToCheck.add(address);
      for (const log of sharedLogs) {
        if (log.args.sender) addressesToCheck.add(log.args.sender);
      }

      // 3. Build handle → token mapping from current balances
      const handleTokenMap = await buildHandleTokenMap(
        publicClient,
        addressesToCheck,
      );

      // 4. Fetch block timestamps
      const allBlockNumbers: bigint[] = [];
      for (const log of [...myGrantsLogs, ...sharedLogs]) {
        if (log.blockNumber != null) allBlockNumbers.push(log.blockNumber);
      }
      const timestamps =
        allBlockNumbers.length > 0
          ? await fetchBlockTimestamps(publicClient, allBlockNumbers)
          : new Map<bigint, number>();

      const getTs = (bn: bigint | null) =>
        bn != null ? (timestamps.get(bn) ?? 0) : 0;

      // 5. Build entries
      const toEntry = (
        log: (typeof myGrantsLogs)[number],
        counterpartyField: "sender" | "viewer",
      ): DelegatedViewEntry => {
        const handle = log.args.handle as string;
        const token = handleTokenMap.get(handle.toLowerCase()) ?? null;
        return {
          id: `${log.transactionHash}-${log.logIndex}`,
          handleId: handle,
          counterparty: log.args[counterpartyField] as string,
          token,
          isActive: token !== null,
          timestamp: getTs(log.blockNumber),
          txHash: log.transactionHash!,
        };
      };

      const sortDesc = (a: DelegatedViewEntry, b: DelegatedViewEntry) =>
        b.timestamp - a.timestamp || b.id.localeCompare(a.id);

      const sharedWithMe = sharedLogs
        .map((l) => toEntry(l, "sender"))
        .sort(sortDesc);

      const myGrants = myGrantsLogs
        .map((l) => toEntry(l, "viewer"))
        .sort(sortDesc);

      return { sharedWithMe, myGrants };
    },
    enabled: !!address && !!publicClient,
    refetchInterval: 30_000,
  });

  return {
    sharedWithMe: query.data?.sharedWithMe ?? [],
    myGrants: query.data?.myGrants ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
