"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useHandleClient } from "@/hooks/use-handle-client";

export type RequestRedeemStep =
  | "idle"
  | "encrypting"
  | "submitting"
  | "confirmed"
  | "error";

interface UseRequestRedeemResult {
  step: RequestRedeemStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  requestRedeem: (fundId: bigint, sharesAmount: string) => Promise<boolean>;
  reset: () => void;
}

/** Share token decimals (mirrors cUSDC = 6) */
const SHARE_DECIMALS = 6;

export function useRequestRedeem(): UseRequestRedeemResult {
  const { address } = useAccount();
  const [step, setStep] = useState<RequestRedeemStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { handleClient } = useHandleClient();
  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const publicClient = usePublicClient();

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(undefined);
    resetWrite();
  }, [resetWrite]);

  const requestRedeem = useCallback(
    async (fundId: bigint, sharesAmount: string): Promise<boolean> => {
      if (!address) {
        setError("Wallet not connected");
        setStep("error");
        return false;
      }

      if (!handleClient) {
        setError("Handle client not initialized — please reconnect your wallet");
        setStep("error");
        return false;
      }

      if (!("SHADOW_FUND_VAULT" in CONTRACTS)) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }

      const vaultAddress = (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT;

      try {
        const gasOverrides = await estimateGasOverrides(publicClient);

        // Encrypt the shares amount
        setStep("encrypting");
        const { handle, handleProof } = await handleClient.encryptInput(
          BigInt(Math.round(parseFloat(sharesAmount) * 10 ** SHARE_DECIMALS)),
          "uint256",
          vaultAddress,
        );

        // Submit redemption request
        setStep("submitting");
        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: shadowFundVaultAbi,
          functionName: "requestRedeem",
          args: [fundId, handle, handleProof],
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
    [address, handleClient, writeContractAsync, publicClient],
  );

  return { step, error, txHash, requestRedeem, reset };
}
