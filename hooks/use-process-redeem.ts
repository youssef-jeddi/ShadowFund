"use client";

import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export type ProcessRedeemStep = "idle" | "writing" | "confirmed" | "error";

interface UseProcessRedeemResult {
  step: ProcessRedeemStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  /** Number of redemptions already processed in the active batch. */
  progress: number;
  /** Total number of redemptions in the active batch. */
  total: number;
  processRedeem: (fundId: bigint, userAddress: `0x${string}`) => Promise<boolean>;
  processAll: (fundId: bigint, users: `0x${string}`[]) => Promise<boolean>;
  reset: () => void;
}

export function useProcessRedeem(): UseProcessRedeemResult {
  const [step, setStep] = useState<ProcessRedeemStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(undefined);
    setProgress(0);
    setTotal(0);
    resetWrite();
  }, [resetWrite]);

  const submitOne = useCallback(
    async (fundId: bigint, userAddress: `0x${string}`) => {
      const gasOverrides = await estimateGasOverrides(publicClient);
      const hash = await writeContractAsync({
        address: (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT,
        abi: shadowFundVaultAbi,
        functionName: "processRedeem",
        args: [fundId, userAddress],
        ...gasOverrides,
      });
      setTxHash(hash);
      await publicClient!.waitForTransactionReceipt({ hash });
    },
    [writeContractAsync, publicClient],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["fund"] });
    queryClient.invalidateQueries({ queryKey: ["balance"] });
    queryClient.invalidateQueries({ queryKey: ["readContracts"] });
  }, [queryClient]);

  const processRedeem = useCallback(
    async (fundId: bigint, userAddress: `0x${string}`): Promise<boolean> => {
      if (!("SHADOW_FUND_VAULT" in CONTRACTS)) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }

      try {
        setStep("writing");
        setError(null);
        setProgress(0);
        setTotal(1);
        await submitOne(fundId, userAddress);
        setProgress(1);
        setStep("confirmed");
        invalidate();
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [submitOne, invalidate],
  );

  const processAll = useCallback(
    async (fundId: bigint, users: `0x${string}`[]): Promise<boolean> => {
      if (!("SHADOW_FUND_VAULT" in CONTRACTS)) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }
      if (users.length === 0) return true;

      setStep("writing");
      setError(null);
      setProgress(0);
      setTotal(users.length);

      for (let i = 0; i < users.length; i++) {
        try {
          await submitOne(fundId, users[i]);
          setProgress(i + 1);
        } catch (err) {
          setError(
            `Failed on ${users[i].slice(0, 6)}…${users[i].slice(-4)}: ${formatTransactionError(err)}`,
          );
          setStep("error");
          invalidate();
          return false;
        }
      }

      setStep("confirmed");
      invalidate();
      return true;
    },
    [submitOne, invalidate],
  );

  return { step, error, txHash, progress, total, processRedeem, processAll, reset };
}
