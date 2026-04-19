"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS, ZERO_HANDLE } from "@/lib/contracts";
import { useHandleClient } from "@/hooks/use-handle-client";

export interface DepositorPosition {
  fundId: bigint;
  /** Encrypted running share balance handle (bytes32). */
  sharesHandle: `0x${string}`;
  /** Encrypted lifetime gross deposits handle (bytes32). */
  depositedHandle: `0x${string}`;
  /** Decrypted running shares — formatted string (e.g. "100.00"). */
  sharesDecrypted: string | null;
  /** Decrypted cumulative lifetime deposits — formatted string. */
  depositedDecrypted: string | null;
  /** Approximate yield = sharesDecrypted − depositedDecrypted (lifetime semantics). */
  yieldDecrypted: string | null;
}

const SHARE_DECIMALS = 6;

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

/**
 * Depositor-facing position decryptor.
 *
 * Calls `getDepositorHandles(fundId, msg.sender)` to pull both the encrypted
 * running `shares` and cumulative `deposited` handles, then decrypts both via
 * the Nox handle client. The depositor's wallet is the only party with ACL —
 * decryption from any other signer is rejected by the Nox SDK.
 *
 * `yieldDecrypted` is approximate: `deposited` is lifetime gross (never
 * decremented on partial redeem), so for users with partial redeems it is
 * a lower-bound on actual yield. Documented in feedback.md.
 */
export function useDepositorPosition(fundId: bigint | undefined) {
  const { address } = useAccount();
  const { handleClient } = useHandleClient();

  const [sharesDecrypted, setSharesDecrypted] = useState<string | null>(null);
  const [depositedDecrypted, setDepositedDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = !!address && fundId !== undefined;

  const { data, isLoading, refetch } = useReadContract({
    address: vaultAddress,
    abi: shadowFundVaultAbi,
    functionName: "getDepositorHandles",
    args: enabled
      ? [fundId!, address!]
      : undefined,
    query: {
      enabled,
      refetchInterval: 15_000,
    },
  });

  const [sharesHandle, depositedHandle] = (data ?? [
    ZERO_HANDLE,
    ZERO_HANDLE,
  ]) as readonly [`0x${string}`, `0x${string}`];

  const decrypt = useCallback(async () => {
    if (!handleClient || !enabled) return;

    setDecrypting(true);
    setError(null);

    try {
      const decryptOne = async (handle: `0x${string}`): Promise<string> => {
        if (!handle || handle === ZERO_HANDLE) return "0.00";
        const result = await handleClient.decrypt(handle);
        const raw = result?.value ?? result;
        const value = typeof raw === "bigint" ? raw : BigInt(String(raw));
        return formatUnits(value, SHARE_DECIMALS);
      };

      const [s, d] = await Promise.all([
        decryptOne(sharesHandle),
        decryptOne(depositedHandle),
      ]);

      setSharesDecrypted(s);
      setDepositedDecrypted(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed");
    } finally {
      setDecrypting(false);
    }
  }, [handleClient, enabled, sharesHandle, depositedHandle]);

  // Auto-decrypt once handles + client are both ready
  useEffect(() => {
    if (
      handleClient &&
      enabled &&
      sharesHandle &&
      sharesHandle !== ZERO_HANDLE &&
      sharesDecrypted === null &&
      !decrypting
    ) {
      void decrypt();
    }
  }, [handleClient, enabled, sharesHandle, sharesDecrypted, decrypting, decrypt]);

  const yieldDecrypted =
    sharesDecrypted !== null && depositedDecrypted !== null
      ? (() => {
          const s = Number(sharesDecrypted);
          const d = Number(depositedDecrypted);
          const y = s - d;
          return y.toFixed(2);
        })()
      : null;

  const position: DepositorPosition = {
    fundId: fundId ?? 0n,
    sharesHandle,
    depositedHandle,
    sharesDecrypted,
    depositedDecrypted,
    yieldDecrypted,
  };

  return {
    position,
    isLoading,
    decrypting,
    error,
    decrypt,
    refetch,
  };
}
