"use client";

import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient, useReadContract } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useHandleClient } from "@/hooks/use-handle-client";
import { TEE_COOLDOWN_MS } from "@/lib/config";

export type FinalizeSupplyStep =
  | "idle"
  | "decrypting"
  | "writing"
  | "confirmed"
  | "error";

interface UseFinalizeSupplyResult {
  step: FinalizeSupplyStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  pendingHandle: `0x${string}` | undefined;
  pendingAmount: bigint | undefined;
  finalize: (fundId: bigint) => Promise<boolean>;
  reset: () => void;
}

const vaultAddress = ("SHADOW_FUND_VAULT" in CONTRACTS)
  ? (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT
  : undefined;

/**
 * Reads the pending unwrap handle from the vault, publicly decrypts it via the
 * Nox gateway, and submits `finalizeSupply(fundId, proof)`.
 *
 * Mirrors the retry pattern in hooks/use-unwrap.ts — the TEE needs a cooldown
 * after `initiateSupply` before the handle is publicly decryptable.
 */
export function useFinalizeSupply(fundId: bigint | undefined): UseFinalizeSupplyResult {
  const [step, setStep] = useState<FinalizeSupplyStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { handleClient } = useHandleClient();
  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const publicClient = usePublicClient();

  const { data: pendingHandle, refetch: refetchHandle } = useReadContract({
    address: vaultAddress,
    abi: shadowFundVaultAbi,
    functionName: "getPendingUnwrapHandle",
    args: fundId !== undefined ? [fundId] : undefined,
    query: {
      enabled: !!vaultAddress && fundId !== undefined,
      refetchInterval: 5_000,
    },
  });

  const { data: pendingAmount } = useReadContract({
    address: vaultAddress,
    abi: shadowFundVaultAbi,
    functionName: "getPendingSupplyAmount",
    args: fundId !== undefined ? [fundId] : undefined,
    query: {
      enabled: !!vaultAddress && fundId !== undefined,
      refetchInterval: 5_000,
    },
  });

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(undefined);
    resetWrite();
  }, [resetWrite]);

  const finalize = useCallback(
    async (id: bigint): Promise<boolean> => {
      if (!vaultAddress) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }
      if (!handleClient) {
        setError("Handle client not initialized — please reconnect your wallet");
        setStep("error");
        return false;
      }

      // Always re-read the handle immediately before decrypt, in case the
      // hook was invoked right after initiateSupply confirmed.
      const { data: freshHandle } = await refetchHandle();
      const handle = (freshHandle as `0x${string}` | undefined) ?? (pendingHandle as `0x${string}` | undefined);
      if (!handle || handle === "0x" || /^0x0+$/.test(handle)) {
        setError("No pending supply — call initiateSupply first");
        setStep("error");
        return false;
      }

      try {
        setStep("decrypting");
        setError(null);

        const MAX_RETRIES = 5;
        let decryptionProof: `0x${string}` | undefined;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const result = await Promise.race([
              handleClient.publicDecrypt(handle),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("publicDecrypt timeout")), 15_000),
              ),
            ]);
            decryptionProof = result.decryptionProof;
            break;
          } catch {
            if (attempt === MAX_RETRIES) {
              throw new Error(
                "Unable to decrypt unwrap handle after multiple attempts — the TEE may be congested. Please retry later.",
              );
            }
            await new Promise((r) => setTimeout(r, TEE_COOLDOWN_MS));
          }
        }
        if (!decryptionProof) {
          throw new Error("Decryption proof not available");
        }

        const gasOverrides = await estimateGasOverrides(publicClient);

        setStep("writing");
        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: shadowFundVaultAbi,
          functionName: "finalizeSupply",
          args: [id, decryptionProof],
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
    [handleClient, writeContractAsync, publicClient, refetchHandle, pendingHandle],
  );

  return {
    step,
    error,
    txHash,
    pendingHandle: pendingHandle as `0x${string}` | undefined,
    pendingAmount: pendingAmount as bigint | undefined,
    finalize,
    reset,
  };
}
