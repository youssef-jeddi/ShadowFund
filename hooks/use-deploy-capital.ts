"use client";

import { useState, useCallback } from "react";
import { parseUnits } from "viem";
import { useWriteContract, usePublicClient, useReadContract } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useHandleClient } from "@/hooks/use-handle-client";
import { TEE_COOLDOWN_MS } from "@/lib/config";

export type DeployCapitalStep =
  | "idle"
  | "initiating"
  | "cooldown"
  | "decrypting"
  | "finalizing"
  | "confirmed"
  | "error";

interface UseDeployCapitalResult {
  step: DeployCapitalStep;
  error: string | null;
  initiateTxHash: `0x${string}` | undefined;
  finalizeTxHash: `0x${string}` | undefined;
  pendingAmount: bigint | undefined;
  pendingHandle: `0x${string}` | undefined;
  /** Bulk deploy: plaintext USDC amount (human-readable string, e.g. "150.5") */
  deploy: (fundId: bigint, amount: string) => Promise<boolean>;
  /** Manual retry of finalize (if TEE stalled between steps) */
  retryFinalize: (fundId: bigint) => Promise<boolean>;
  reset: () => void;
}

const USDC_DECIMALS = 6;
const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

/**
 * Two-step bulk capital deployment to the 2 sub-vaults (AaveUSDCVault + FixedYieldVault).
 * Slices the plaintext total by the fund's public allocationBps at finalize time.
 *
 * Flow:
 *   deployCapital(fundId, amount)      // encrypt + cUSDC.unwrap
 *   → TEE cooldown
 *   → publicDecrypt(pendingUnwrapHandle)
 *   → finalizeDeployCapital(fundId, proof)   // fans out to sub-vaults
 */
export function useDeployCapital(fundId: bigint | undefined): UseDeployCapitalResult {
  const [step, setStep] = useState<DeployCapitalStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [initiateTxHash, setInitiateTxHash] = useState<`0x${string}` | undefined>();
  const [finalizeTxHash, setFinalizeTxHash] = useState<`0x${string}` | undefined>();

  const { handleClient } = useHandleClient();
  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const publicClient = usePublicClient();

  const { data: pendingHandleRaw, refetch: refetchHandle } = useReadContract({
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
    functionName: "getPendingDeployAmount",
    args: fundId !== undefined ? [fundId] : undefined,
    query: {
      enabled: !!vaultAddress && fundId !== undefined,
      refetchInterval: 5_000,
    },
  });

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setInitiateTxHash(undefined);
    setFinalizeTxHash(undefined);
    resetWrite();
  }, [resetWrite]);

  const runFinalize = useCallback(
    async (id: bigint): Promise<boolean> => {
      if (!handleClient) {
        setError("Handle client not initialized");
        setStep("error");
        return false;
      }

      const { data: freshHandle } = await refetchHandle();
      const handle =
        (freshHandle as `0x${string}` | undefined) ??
        (pendingHandleRaw as `0x${string}` | undefined);
      if (!handle || handle === "0x" || /^0x0+$/.test(handle)) {
        setError("No pending deployment — call deployCapital first");
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
                "Unable to decrypt unwrap handle after multiple attempts — the TEE may be congested. Retry finalize in a moment.",
              );
            }
            await new Promise((r) => setTimeout(r, TEE_COOLDOWN_MS));
          }
        }
        if (!decryptionProof) throw new Error("Decryption proof not available");

        const gasOverrides = await estimateGasOverrides(publicClient);

        setStep("finalizing");
        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: shadowFundVaultAbi,
          functionName: "finalizeDeployCapital",
          args: [id, decryptionProof],
          ...gasOverrides,
        });

        setFinalizeTxHash(hash);
        await publicClient!.waitForTransactionReceipt({ hash });
        setStep("confirmed");
        return true;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [handleClient, writeContractAsync, publicClient, refetchHandle, pendingHandleRaw],
  );

  const deploy = useCallback(
    async (id: bigint, amount: string): Promise<boolean> => {
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
        setStep("initiating");
        setError(null);

        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: shadowFundVaultAbi,
          functionName: "deployCapital",
          args: [id, parsed],
          ...gasOverrides,
        });
        setInitiateTxHash(hash);
        await publicClient!.waitForTransactionReceipt({ hash });

        setStep("cooldown");
        await new Promise((r) => setTimeout(r, TEE_COOLDOWN_MS));

        return await runFinalize(id);
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return false;
      }
    },
    [writeContractAsync, publicClient, runFinalize],
  );

  const retryFinalize = useCallback(
    async (id: bigint) => runFinalize(id),
    [runFinalize],
  );

  return {
    step,
    error,
    initiateTxHash,
    finalizeTxHash,
    pendingAmount: pendingAmount as bigint | undefined,
    pendingHandle: pendingHandleRaw as `0x${string}` | undefined,
    deploy,
    retryFinalize,
    reset,
  };
}
