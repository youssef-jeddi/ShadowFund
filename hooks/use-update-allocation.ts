"use client";

import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";

export type UpdateAllocationStep = "idle" | "writing" | "confirmed" | "error";

interface UseUpdateAllocationResult {
  step: UpdateAllocationStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  /** Manager-only. Affects only future deployCapital slices; does not rebalance. */
  updateAllocation: (
    fundId: bigint,
    newBps: readonly [number, number],
  ) => Promise<boolean>;
  reset: () => void;
}

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

export function useUpdateAllocation(): UseUpdateAllocationResult {
  const [step, setStep] = useState<UpdateAllocationStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const publicClient = usePublicClient();

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(undefined);
    resetWrite();
  }, [resetWrite]);

  const updateAllocation = useCallback(
    async (fundId: bigint, newBps: readonly [number, number]): Promise<boolean> => {
      if (newBps[0] + newBps[1] !== 10000) {
        setError("Allocation must sum to 10000 bps (100%).");
        setStep("error");
        return false;
      }

      try {
        const gasOverrides = await estimateGasOverrides(publicClient);
        setStep("writing");
        setError(null);

        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: shadowFundVaultAbi,
          functionName: "updateAllocation",
          args: [fundId, [BigInt(newBps[0]), BigInt(newBps[1])] as const],
          ...gasOverrides,
        });

        setTxHash(hash);
        await publicClient!.waitForTransactionReceipt({ hash });
        setStep("confirmed");
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [writeContractAsync, publicClient],
  );

  return { step, error, txHash, updateAllocation, reset };
}
