"use client";

import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export type RevealStrategyStep = "idle" | "writing" | "confirmed" | "error";

export interface PlaintextStrategy {
  /** WETH allocation in basis points (0-10000). USDC = 10000 - wethBps. */
  wethBps: number;
}

interface UseRevealStrategyResult {
  step: RevealStrategyStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  revealStrategy: (fundId: bigint, strategy: PlaintextStrategy) => Promise<boolean>;
  reset: () => void;
}

export function useRevealStrategy(): UseRevealStrategyResult {
  const [step, setStep] = useState<RevealStrategyStep>("idle");
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

  const revealStrategy = useCallback(
    async (fundId: bigint, strategy: PlaintextStrategy): Promise<boolean> => {
      if (!("SHADOW_FUND_VAULT" in CONTRACTS)) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }

      const { wethBps } = strategy;
      if (!Number.isInteger(wethBps) || wethBps < 0 || wethBps > 10_000) {
        setError(`wethBps must be an integer in [0, 10000] (got ${wethBps})`);
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
          functionName: "revealStrategy",
          args: [fundId, BigInt(wethBps)],
          ...gasOverrides,
        });

        setTxHash(hash);
        await publicClient!.waitForTransactionReceipt({ hash });
        setStep("confirmed");

        // Invalidate fund data so the reveal page gets fresh state
        queryClient.invalidateQueries({ queryKey: ["fund", fundId.toString()] });
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

  return { step, error, txHash, revealStrategy, reset };
}
