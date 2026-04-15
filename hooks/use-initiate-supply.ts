"use client";

import { useState, useCallback } from "react";
import { parseUnits } from "viem";
import { useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";

export type InitiateSupplyStep = "idle" | "writing" | "confirmed" | "error";

interface UseInitiateSupplyResult {
  step: InitiateSupplyStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  /** amount is plaintext USDC (human-readable string, e.g. "100.5") */
  initiateSupply: (fundId: bigint, amount: string) => Promise<boolean>;
  reset: () => void;
}

const USDC_DECIMALS = 6;

export function useInitiateSupply(): UseInitiateSupplyResult {
  const [step, setStep] = useState<InitiateSupplyStep>("idle");
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

  const initiateSupply = useCallback(
    async (fundId: bigint, amount: string): Promise<boolean> => {
      if (!("SHADOW_FUND_VAULT" in CONTRACTS)) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }

      const vaultAddress = (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT;

      let parsed: bigint;
      try {
        parsed = parseUnits(amount, USDC_DECIMALS);
      } catch {
        setError(`Invalid amount: ${amount}`);
        setStep("error");
        return false;
      }
      if (parsed === 0n) {
        setError("Amount must be greater than zero");
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
          functionName: "initiateSupply",
          args: [fundId, parsed],
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

  return { step, error, txHash, initiateSupply, reset };
}
