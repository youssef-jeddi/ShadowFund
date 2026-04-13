"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { erc20Abi } from "viem";
import { confidentialTokenAbi } from "@/lib/confidential-token-abi";
import { noxComputeAbi, NOX_COMPUTE_ADDRESS } from "@/lib/nox-compute-abi";
import { CONTRACTS } from "@/lib/contracts";
import { formatBalance } from "@/lib/format";
import { CONFIG } from "@/lib/config";
import type { ActivityEntry } from "@/lib/activity";
import type { GetContractEventsReturnType, PublicClient } from "viem";

const TOKEN_PAIRS = [
  {
    underlying: CONTRACTS.RLC as `0x${string}`,
    cToken: CONTRACTS.cRLC as `0x${string}`,
    asset: "cRLC",
    decimals: 9,
  },
  {
    underlying: CONTRACTS.USDC as `0x${string}`,
    cToken: CONTRACTS.cUSDC as `0x${string}`,
    asset: "cUSDC",
    decimals: 6,
  },
] as const;


type ConfTransferLog = GetContractEventsReturnType<typeof confidentialTokenAbi, "ConfidentialTransfer">[number];

function formatTimestamp(seconds: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

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

export interface UseActivityHistoryResult {
  entries: ActivityEntry[];
  isLoading: boolean;
  error: string | null;
}

export function useActivityHistory(): UseActivityHistoryResult {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (!address || !publicClient) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchActivity() {
      try {
        if (!publicClient || !address) return;

        const allBlockNumbers: bigint[] = [];
        const allEntries: ActivityEntry[] = [];

        // Fetch all events in parallel (full range)
        const pairResults = await Promise.all(
          TOKEN_PAIRS.map(async (pair) => {
            const [wrapLogs, unwrapLogs, confFromLogs, confToLogs] = await Promise.all([
              publicClient.getContractEvents({
                address: pair.underlying,
                abi: erc20Abi,
                eventName: "Transfer",
                args: { from: address, to: pair.cToken },
                fromBlock: 0n,
              }),
              publicClient.getContractEvents({
                address: pair.cToken,
                abi: confidentialTokenAbi,
                eventName: "UnwrapFinalized",
                args: { receiver: address },
                fromBlock: 0n,
              }),
              publicClient.getContractEvents({
                address: pair.cToken,
                abi: confidentialTokenAbi,
                eventName: "ConfidentialTransfer",
                args: { from: address },
                fromBlock: 0n,
              }),
              publicClient.getContractEvents({
                address: pair.cToken,
                abi: confidentialTokenAbi,
                eventName: "ConfidentialTransfer",
                args: { to: address },
                fromBlock: 0n,
              }),
            ]);
            return { pair, wrapLogs, unwrapLogs, confFromLogs, confToLogs };
          }),
        );

        // Fetch ViewerAdded events from NoxCompute (separate from per-token queries)
        const viewerLogs = await publicClient.getContractEvents({
          address: NOX_COMPUTE_ADDRESS as `0x${string}`,
          abi: noxComputeAbi,
          eventName: "ViewerAdded",
          args: { sender: address },
          fromBlock: 0n,
        });

        // Collect block numbers
        for (const log of viewerLogs) {
          if (log.blockNumber != null) allBlockNumbers.push(log.blockNumber);
        }
        for (const { wrapLogs, unwrapLogs, confFromLogs, confToLogs } of pairResults) {
          for (const logs of [wrapLogs, unwrapLogs, confFromLogs, confToLogs]) {
            for (const log of logs) {
              if (log.blockNumber != null) allBlockNumbers.push(log.blockNumber);
            }
          }
        }

        // Batch fetch timestamps
        const timestamps = allBlockNumbers.length > 0
          ? await fetchBlockTimestamps(publicClient, allBlockNumbers)
          : new Map<bigint, number>();

        const getTs = (bn: bigint | null) =>
          bn != null ? formatTimestamp(timestamps.get(bn) ?? 0) : formatTimestamp(0);

        // Build entries
        for (const { pair, wrapLogs, unwrapLogs, confFromLogs, confToLogs } of pairResults) {
          for (const log of wrapLogs) {
            if (log.args.value == null) continue;
            allEntries.push({
              id: `${log.transactionHash}-${log.logIndex}`,
              type: "wrap",
              asset: pair.asset,
              amount: formatBalance(log.args.value, pair.decimals),
              timestamp: getTs(log.blockNumber),
              txHash: log.transactionHash!,
            });
          }

          for (const log of unwrapLogs) {
            if (log.args.cleartextAmount == null) continue;
            allEntries.push({
              id: `${log.transactionHash}-${log.logIndex}`,
              type: "unwrap",
              asset: pair.asset,
              amount: formatBalance(log.args.cleartextAmount, pair.decimals),
              timestamp: getTs(log.blockNumber),
              txHash: log.transactionHash!,
            });
          }

          const confMap = new Map<string, ConfTransferLog>();
          for (const log of confFromLogs.concat(confToLogs)) {
            confMap.set(`${log.transactionHash}-${log.logIndex}`, log);
          }
          for (const log of confMap.values()) {
            allEntries.push({
              id: `${log.transactionHash}-${log.logIndex}`,
              type: "transfer",
              asset: pair.asset,
              amount: "Encrypted",
              timestamp: getTs(log.blockNumber),
              txHash: log.transactionHash!,
            });
          }

        }

        // Build delegation entries from NoxCompute ViewerAdded events
        for (const log of viewerLogs) {
          const viewer = log.args.viewer;
          allEntries.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: "delegation",
            asset: "ACL",
            amount: viewer ? `${viewer.slice(0, 6)}...${viewer.slice(-4)}` : "—",
            timestamp: getTs(log.blockNumber),
            txHash: log.transactionHash!,
          });
        }

        // Sort newest first
        allEntries.sort((a, b) =>
          b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
        );

        if (!cancelled) {
          setEntries(allEntries);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch activity");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchActivity();
    intervalRef.current = setInterval(fetchActivity, CONFIG.timing.activityPollMs);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [address, publicClient]);

  return { entries, isLoading, error };
}
