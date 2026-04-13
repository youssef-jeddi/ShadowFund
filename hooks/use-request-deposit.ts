"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits, encodeAbiParameters } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";
import { useHandleClient } from "@/hooks/use-handle-client";
import { useInvalidateBalances } from "@/hooks/use-invalidate-balances";

export type RequestDepositStep =
  | "idle"
  | "encrypting"
  | "depositing"
  | "confirmed"
  | "error";

// Minimal ABI for cUSDC's confidentialTransferAndCall (not in base ABI file)
const transferAndCallAbi = [
  {
    type: "function",
    name: "confidentialTransferAndCall",
    inputs: [
      { name: "to",              type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof",      type: "bytes"   },
      { name: "data",            type: "bytes"   },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

interface UseRequestDepositResult {
  step: RequestDepositStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  requestDeposit: (fundId: bigint, amount: string) => Promise<boolean>;
  reset: () => void;
}

/** cUSDC decimals */
const CUSDC_DECIMALS = 6;

/**
 * Deposit flow via ERC-7984 confidentialTransferAndCall.
 *
 * The depositor calls cUSDC directly with the vault as recipient and
 * `abi.encode(fundId)` as callback data. cUSDC ingests the proof, moves the
 * balance, and invokes `vault.onConfidentialTransferReceived(...)` with an
 * `euint256` already ACL'd to the vault. This avoids the operator /
 * confidentialTransferFrom flow which fails with Nox `InvalidProof` because
 * ERC-7984 proofs bind to the end user who calls the token contract directly.
 */
export function useRequestDeposit(): UseRequestDepositResult {
  const { address } = useAccount();
  const [step, setStep] = useState<RequestDepositStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { handleClient } = useHandleClient();
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

  const requestDeposit = useCallback(
    async (fundId: bigint, amount: string): Promise<boolean> => {
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

      if (!vaultAddress) {
        setError("ShadowFundVault not deployed yet");
        setStep("error");
        return false;
      }

      const parsedAmount = parseUnits(amount, CUSDC_DECIMALS);
      if (parsedAmount === 0n) {
        setError("Amount must be greater than zero");
        setStep("error");
        return false;
      }

      try {
        const gasOverrides = await estimateGasOverrides(publicClient);

        // Encrypt the amount targeting cUSDC (the consumer of the proof).
        setStep("encrypting");
        const { handle, handleProof } = await handleClient.encryptInput(
          parsedAmount,
          "uint256",
          CONTRACTS.cUSDC as `0x${string}`,
        );

        // Encode fundId so the vault callback knows which fund to credit.
        const callbackData = encodeAbiParameters(
          [{ type: "uint256" }],
          [fundId],
        );

        // Simulate first so revert reasons surface before the wallet prompt.
        setStep("depositing");
        const gasEstimate = await publicClient!.estimateContractGas({
          account: address,
          address: CONTRACTS.cUSDC as `0x${string}`,
          abi: transferAndCallAbi,
          functionName: "confidentialTransferAndCall",
          args: [vaultAddress, handle, handleProof, callbackData],
        });

        const hash = await writeContractAsync({
          address: CONTRACTS.cUSDC as `0x${string}`,
          abi: transferAndCallAbi,
          functionName: "confidentialTransferAndCall",
          args: [vaultAddress, handle, handleProof, callbackData],
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
    [address, handleClient, vaultAddress, writeContractAsync, publicClient, invalidateBalances],
  );

  return { step, error, txHash, requestDeposit, reset };
}
