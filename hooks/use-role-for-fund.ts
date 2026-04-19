"use client";

import { useAccount, useReadContract } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS, ZERO_HANDLE } from "@/lib/contracts";
import { useFund } from "@/hooks/use-fund";

export type FundRole = "manager" | "depositor" | "both" | "none";

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

/**
 * Detects the connected wallet's role for a given fund:
 *   - manager:   wallet == fund.manager, no encrypted share handle
 *   - depositor: wallet != fund.manager, has encrypted share handle
 *   - both:      wallet == fund.manager AND has encrypted share handle
 *                (manager deposited into their own fund — allowed)
 *   - none:      neither
 */
export function useRoleForFund(fundId: bigint | undefined): {
  role: FundRole;
  isLoading: boolean;
} {
  const { address } = useAccount();
  const { fund, isLoading: fundLoading } = useFund(fundId);

  const enabled = !!address && fundId !== undefined && !!fund;

  const { data: shareHandle, isLoading: handleLoading } = useReadContract({
    address: vaultAddress,
    abi: shadowFundVaultAbi,
    functionName: "shareBalanceOf",
    args: enabled && address ? [fundId!, address] : undefined,
    query: { enabled },
  });

  if (!address || !fund) {
    return { role: "none", isLoading: fundLoading || handleLoading };
  }

  const isManager =
    fund.manager.toLowerCase() === address.toLowerCase();

  const handle = (shareHandle ?? ZERO_HANDLE) as `0x${string}`;
  const hasPosition = handle !== ZERO_HANDLE && !/^0x0+$/.test(handle);

  const role: FundRole =
    isManager && hasPosition
      ? "both"
      : isManager
      ? "manager"
      : hasPosition
      ? "depositor"
      : "none";

  return { role, isLoading: fundLoading || handleLoading };
}
