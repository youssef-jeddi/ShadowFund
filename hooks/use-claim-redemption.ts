"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useInvalidateBalances } from "@/hooks/use-invalidate-balances";

export type ClaimRedemptionStep =
  | "idle"
  | "claiming"
  | "confirmed"
  | "error";

interface UseClaimRedemptionResult {
  step: ClaimRedemptionStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  claimRedemption: (fundId: bigint) => Promise<boolean>;
  reset: () => void;
}

/**
 * Claim redeemed cUSDC. The vault owns an `euint256` claimable handle set during
 * processRedeem, so no handle/proof is passed — the vault calls the `euint256`
 * overload of `cUSDC.confidentialTransfer` directly.
 */
export function useClaimRedemption(): UseClaimRedemptionResult {
  const { address } = useAccount();
  const [step, setStep] = useState<ClaimRedemptionStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const publicClient = usePublicClient();
  const invalidateBalances = useInvalidateBalances();

  const vaultAddress = ("SHADOW_FUND_VAULT" in CONTRACTS)
    ? (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT
    : undefined;

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(undefined);
    resetWrite();
  }, [resetWrite]);

  const claimRedemption = useCallback(
    async (fundId: bigint): Promise<boolean> => {
      if (!address) {
        setError("Wallet not connected");
        setStep("error");
        return false;
      }

      if (!vaultAddress) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }

      try {
        const gasOverrides = await estimateGasOverrides(publicClient);

        setStep("claiming");
        const gasEstimate = await publicClient!.estimateContractGas({
          account: address,
          address: vaultAddress,
          abi: shadowFundVaultAbi,
          functionName: "claimRedemption",
          args: [fundId],
        });

        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: shadowFundVaultAbi,
          functionName: "claimRedemption",
          args: [fundId],
          gas: (gasEstimate * 120n) / 100n,
          ...gasOverrides,
        });

        setTxHash(hash);
        await publicClient!.waitForTransactionReceipt({ hash });
        setStep("confirmed");
        invalidateBalances();
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [address, vaultAddress, writeContractAsync, publicClient, invalidateBalances],
  );

  return { step, error, txHash, claimRedemption, reset };
}
