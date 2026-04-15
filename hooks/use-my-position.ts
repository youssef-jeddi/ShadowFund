"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";
import { ZERO_HANDLE } from "@/lib/contracts";
import { useHandleClient } from "@/hooks/use-handle-client";
import { formatUnits } from "viem";

export interface MyPosition {
  fundId: bigint;
  /** Encrypted share balance handle (bytes32) */
  shareHandle: `0x${string}`;
  /** Decrypted share balance as a formatted string (e.g. "100.00") */
  decryptedBalance: string | null;
  hasPendingRedeem: boolean;
  /** True when processRedeem has been called and user can claim their cUSDC */
  isClaimable: boolean;
}

const SHARE_DECIMALS = 6;

const vaultAddress = ("SHADOW_FUND_VAULT" in CONTRACTS)
  ? (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT
  : undefined;

/**
 * Returns a user's position in a specific fund:
 * - their encrypted share balance handle
 * - the decrypted balance (fetched via Nox JS SDK, user-gated)
 * - pending deposit/redeem status
 */
export function useMyPosition(fundId: bigint | undefined) {
  const { address } = useAccount();
  const { handleClient } = useHandleClient();
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  const enabled = !!vaultAddress && !!address && fundId !== undefined;

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "shareBalanceOf",
        args: [fundId ?? 0n, address ?? "0x0000000000000000000000000000000000000000"],
      },
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "hasPendingRedeem",
        args: [fundId ?? 0n, address ?? "0x0000000000000000000000000000000000000000"],
      },
      {
        address: vaultAddress as `0x${string}`,
        abi: shadowFundVaultAbi,
        functionName: "isClaimable",
        args: [fundId ?? 0n, address ?? "0x0000000000000000000000000000000000000000"],
      },
    ],
    query: {
      enabled,
      refetchInterval: 15_000,
    },
  });

  const shareHandle = (data?.[0]?.result ?? ZERO_HANDLE) as `0x${string}`;
  const hasPendingRedeem  = (data?.[1]?.result ?? false) as boolean;
  const isClaimableResult = (data?.[2]?.result ?? false) as boolean;

  /** Trigger a client-side decryption of the share balance via Nox JS SDK. */
  const decryptBalance = useCallback(async () => {
    if (!handleClient || !shareHandle || shareHandle === ZERO_HANDLE) {
      setDecryptedBalance("0.00");
      return;
    }

    setDecrypting(true);
    setDecryptError(null);
    try {
      const result = await handleClient.decrypt(shareHandle);
      const raw = result?.value ?? result;
      const value = typeof raw === "bigint" ? raw : BigInt(String(raw));
      setDecryptedBalance(formatUnits(value, SHARE_DECIMALS));
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : "Decryption failed");
    } finally {
      setDecrypting(false);
    }
  }, [handleClient, shareHandle]);

  const position: MyPosition = {
    fundId: fundId ?? 0n,
    shareHandle,
    decryptedBalance,
    hasPendingRedeem,
    isClaimable: isClaimableResult,
  };

  return {
    position,
    isLoading,
    decrypting,
    decryptError,
    decryptBalance,
    refetch,
  };
}
