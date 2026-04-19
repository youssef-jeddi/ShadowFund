"use client";

import { useState, useCallback } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { estimateGasOverrides } from "@/lib/gas";
import { formatTransactionError } from "@/lib/utils";

export type CreateFundStep = "idle" | "writing" | "confirmed" | "error";

interface UseCreateFundResult {
  step: CreateFundStep;
  error: string | null;
  txHash: `0x${string}` | undefined;
  fundId: bigint | undefined;
  createFund: (
    name: string,
    description: string,
    perfFeeBps: number,
    allocationBps: readonly [number, number],
  ) => Promise<bigint | null>;
  reset: () => void;
}

export function useCreateFund(): UseCreateFundResult {
  const [step, setStep] = useState<CreateFundStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [fundId, setFundId] = useState<bigint | undefined>();

  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const publicClient = usePublicClient();

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(undefined);
    setFundId(undefined);
    resetWrite();
  }, [resetWrite]);

  const createFund = useCallback(
    async (
      name: string,
      description: string,
      perfFeeBps: number,
      allocationBps: readonly [number, number],
    ): Promise<bigint | null> => {
      if (!("SHADOW_FUND_VAULT" in CONTRACTS)) {
        setError("ShadowFundVault not deployed yet — run npm run deploy:arb");
        setStep("error");
        return null;
      }

      if (allocationBps[0] + allocationBps[1] !== 10000) {
        setError("Allocation must sum to 10000 bps (100%).");
        setStep("error");
        return null;
      }

      try {
        const gasOverrides = await estimateGasOverrides(publicClient);
        setStep("writing");
        setError(null);

        const hash = await writeContractAsync({
          address: (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT,
          abi: shadowFundVaultAbi,
          functionName: "createFund",
          args: [
            name,
            description,
            BigInt(perfFeeBps),
            [BigInt(allocationBps[0]), BigInt(allocationBps[1])] as const,
          ],
          ...gasOverrides,
        });

        setTxHash(hash);
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        // Parse FundCreated event to get the fundId
        const vaultAbiItem = shadowFundVaultAbi.find(
          (item) => "name" in item && item.name === "FundCreated",
        );
        let createdFundId: bigint | undefined;
        if (receipt.logs.length > 0) {
          // FundCreated is the first topic — fundId is the first indexed param
          createdFundId = BigInt(receipt.logs[0]?.topics?.[1] ?? "0");
        }
        setFundId(createdFundId);
        setStep("confirmed");
        return createdFundId ?? null;
      } catch (err) {
        setError(formatTransactionError(err));
        setStep("error");
        return null;
      }
    },
    [writeContractAsync, publicClient],
  );

  return { step, error, txHash, fundId, createFund, reset };
}
