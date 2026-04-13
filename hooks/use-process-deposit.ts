"use client";

import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export type ProcessDepositStep = "idle" | "writing" | "confirmed" | "error";

interface UseProcessDepositResult {
  step: ProcessDepositStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  processDeposit: (fundId: bigint, userAddress: `0x${string}`) => Promise<boolean>;
  reset: () => void;
}

export function useProcessDeposit(): UseProcessDepositResult {
  const [step, setStep] = useState<ProcessDepositStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(undefined);
    resetWrite();
  }, [resetWrite]);

  const processDeposit = useCallback(
    async (fundId: bigint, userAddress: `0x${string}`): Promise<boolean> => {
      if (!("SHADOW_FUND_VAULT" in CONTRACTS)) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }

      try {
        const gasOverrides = await estimateGasOverrides(publicClient);
        setStep("writing");
        setError(null);

        const hash = await writeContractAsync({
          address: (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT,
          abi: shadowFundVaultAbi,
          functionName: "processDeposit",
          args: [fundId, userAddress],
          ...gasOverrides,
        });

        setTxHash(hash);
        await publicClient!.waitForTransactionReceipt({ hash });
        setStep("confirmed");

        // Invalidate fund-related queries
        queryClient.invalidateQueries({ queryKey: ["fund"] });
        queryClient.invalidateQueries({ queryKey: ["readContracts"] });
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [writeContractAsync, publicClient, queryClient],
  );

  return { step, error, txHash, processDeposit, reset };
}
