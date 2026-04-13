"use client";

import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useHandleClient } from "@/hooks/use-handle-client";

export type SetStrategyStep =
  | "idle"
  | "encrypting_eth"
  | "encrypting_btc"
  | "encrypting_link"
  | "encrypting_usdc"
  | "writing"
  | "confirmed"
  | "error";

export interface StrategyAllocation {
  /** Percentage for ETH (0-100) */
  eth: number;
  /** Percentage for BTC (0-100) */
  btc: number;
  /** Percentage for LINK (0-100) */
  link: number;
  /** Percentage for USDC (0-100) */
  usdc: number;
}

interface UseSetStrategyResult {
  step: SetStrategyStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  setStrategy: (fundId: bigint, allocation: StrategyAllocation) => Promise<boolean>;
  reset: () => void;
}

export function useSetStrategy(): UseSetStrategyResult {
  const [step, setStep] = useState<SetStrategyStep>("idle");
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

  const setStrategy = useCallback(
    async (fundId: bigint, allocation: StrategyAllocation): Promise<boolean> => {
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

      // Validate sum
      const total = allocation.eth + allocation.btc + allocation.link + allocation.usdc;
      if (total !== 100) {
        setError(`Percentages must sum to 100 (got ${total})`);
        setStep("error");
        return false;
      }

      try {
        const gasOverrides = await estimateGasOverrides(publicClient);

        // Encrypt each percentage sequentially (Nox gateway enforces per-wallet ordering)
        setStep("encrypting_eth");
        const { handle: hEth, handleProof: pEth } = await handleClient.encryptInput(
          BigInt(allocation.eth),
          "uint256",
          vaultAddress,
        );

        setStep("encrypting_btc");
        const { handle: hBtc, handleProof: pBtc } = await handleClient.encryptInput(
          BigInt(allocation.btc),
          "uint256",
          vaultAddress,
        );

        setStep("encrypting_link");
        const { handle: hLink, handleProof: pLink } = await handleClient.encryptInput(
          BigInt(allocation.link),
          "uint256",
          vaultAddress,
        );

        setStep("encrypting_usdc");
        const { handle: hUsdc, handleProof: pUsdc } = await handleClient.encryptInput(
          BigInt(allocation.usdc),
          "uint256",
          vaultAddress,
        );

        setStep("writing");
        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: shadowFundVaultAbi,
          functionName: "setStrategy",
          args: [
            fundId,
            hEth,  pEth,
            hBtc,  pBtc,
            hLink, pLink,
            hUsdc, pUsdc,
          ],
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
    [handleClient, writeContractAsync, publicClient],
  );

  return { step, error, txHash, setStrategy, reset };
}
