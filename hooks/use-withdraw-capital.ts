"use client";

import { useState, useCallback } from "react";
import { parseUnits } from "viem";
import { useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";

export type WithdrawCapitalStep = "idle" | "writing" | "confirmed" | "error";

interface UseWithdrawCapitalResult {
  step: WithdrawCapitalStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  /** Plaintext USDC amount to pull back from the 2 sub-vaults. */
  withdraw: (fundId: bigint, amount: string) => Promise<boolean>;
  reset: () => void;
}

const USDC_DECIMALS = 6;

/**
 * Manager-only: pulls USDC back from the 2 sub-vaults proportional to current
 * per-vault exposure, then re-wraps as cUSDC. Share price rises implicitly.
 */
export function useWithdrawCapital(): UseWithdrawCapitalResult {
  const [step, setStep] = useState<WithdrawCapitalStep>("idle");
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

  const withdraw = useCallback(
    async (fundId: bigint, amount: string): Promise<boolean> => {
      const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

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
          functionName: "withdrawCapital",
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

  return { step, error, txHash, withdraw, reset };
}
