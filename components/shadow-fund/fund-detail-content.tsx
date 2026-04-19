"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFund } from "@/hooks/use-fund";
import { useMyPosition } from "@/hooks/use-my-position";
import { useRequestDeposit } from "@/hooks/use-request-deposit";
import { useRequestRedeem } from "@/hooks/use-request-redeem";
import { useClaimRedemption } from "@/hooks/use-claim-redemption";
import { useSubVaultMetrics } from "@/hooks/use-subvault-metrics";
import { truncateAddress } from "@/lib/utils";
import { formatUnits } from "viem";
import Link from "next/link";

const SLOT_LABELS = ["Aave USDC", "Fixed 8%"] as const;
const SLOT_COLORS = ["#10b981", "#f59e0b"] as const;

interface FundDetailContentProps {
  fundId: bigint;
}

export function FundDetailContent({ fundId }: FundDetailContentProps) {
  const { address } = useAccount();
  const { fund, isLoading } = useFund(fundId);
  const { position, decrypting, decryptBalance, decryptError } = useMyPosition(fundId);
  const { metrics } = useSubVaultMetrics(fundId);
  const depositHook = useRequestDeposit();
  const redeemHook = useRequestRedeem();
  const claimHook = useClaimRedemption();

  const [depositAmount, setDepositAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "redeem" | "claim">("deposit");

  const isManager = address?.toLowerCase() === fund?.manager.toLowerCase();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!fund) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-text-body">Fund not found or not yet deployed.</p>
        <Button asChild variant="outline">
          <Link href="/funds">Back to Funds</Link>
        </Button>
      </div>
    );
  }

  // Blended APY = allocationBps · apyBps / 10_000
  const [aaveBps, fixedBps] = fund.allocationBps;
  const blendedApyBps =
    (aaveBps * metrics.apys[0] + fixedBps * metrics.apys[1]) / 10_000;
  const blendedApyPct = (blendedApyBps / 100).toFixed(2);
  const hasAllocation = fund.allocationSet;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/funds" className="text-sm text-text-muted hover:text-text-body">
        ← All Funds
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">{fund.name}</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            by {truncateAddress(fund.manager)}
          </p>
          {fund.description && (
            <p className="mt-2 text-text-body">{fund.description}</p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "var(--sf-violet-subtle)",
            color: "var(--sf-violet-text)",
          }}
        >
          Public strategy
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Depositors", value: fund.depositorCount.toString() },
          { label: "Deployed", value: `${formatUnits(fund.totalDeployed, 6)} USDC` },
          { label: "Fee", value: `${(Number(fund.performanceFeeBps) / 100).toFixed(2)}%` },
          {
            label: "Blended APY",
            value: hasAllocation ? `${blendedApyPct}%` : "—",
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-xl px-3 py-2"
            style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
          >
            <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
            <span className="text-sm font-medium text-text-body">{value}</span>
          </div>
        ))}
      </div>

      {/* Public allocation */}
      {hasAllocation && (
        <Card
          className="rounded-2xl border"
          style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
        >
          <CardHeader className="px-5 pt-4 pb-0">
            <h3 className="text-sm font-semibold text-text-heading">Fund Allocation</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Fully transparent mix — only depositor positions are private.
            </p>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <AllocationBars allocation={fund.allocationBps} apys={metrics.apys} />
          </CardContent>
        </Card>
      )}

      {/* My position — encrypted shares only (sf shares). A dedicated
           "Your Private Position" card on the depositor dashboard shows
           decrypted deposited + yield via use-depositor-position. */}
      {address && (
        <Card
          className="rounded-2xl border"
          style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
        >
          <CardHeader className="px-5 pt-4 pb-0">
            <h3 className="text-sm font-semibold text-text-heading">My Position</h3>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Balance</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-heading">
                  {position.decryptedBalance !== null
                    ? `${position.decryptedBalance} sfUSDC`
                    : "●●●●●"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  style={{ borderColor: "var(--sf-violet-border)", color: "var(--sf-violet-text)" }}
                  disabled={decrypting}
                  onClick={decryptBalance}
                >
                  {decrypting ? "..." : "Decrypt"}
                </Button>
              </div>
            </div>
            {decryptError && <p className="mt-1 text-xs text-red-400">{decryptError}</p>}
            {position.hasPendingRedeem && (
              <p className="mt-2 text-xs text-blue-400">You have a pending redeem request awaiting processing.</p>
            )}
            {position.isClaimable && (
              <p className="mt-2 text-xs text-emerald-400">Your redemption was processed — switch to the Claim tab to receive your cUSDC.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action area */}
      {address && !isManager && (
        <Card
          className="rounded-2xl border"
          style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
        >
          <CardHeader className="px-5 pt-4 pb-0">
            <div className="flex gap-4 border-b" style={{ borderColor: "var(--sf-card-border)" }}>
              {(["deposit", "redeem", ...(position.isClaimable ? ["claim"] : [])] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`pb-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "border-b-2 text-text-heading"
                      : "text-text-muted hover:text-text-body"
                  }`}
                  style={activeTab === tab ? { borderColor: "var(--sf-violet)" } : {}}
                >
                  {tab === "claim" ? "Claim cUSDC ✓" : tab}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-5 py-4">
            {activeTab === "deposit" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-muted">
                  Your deposit amount is encrypted end-to-end — the fund manager
                  and other depositors cannot see how much you contributed. Need
                  cUSDC?{" "}
                  <Link href="/dashboard" className="underline" style={{ color: "var(--sf-violet-text)" }}>
                    Wrap USDC here.
                  </Link>
                </p>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount (cUSDC)"
                  className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-400"
                  style={{ borderColor: "var(--sf-card-border)" }}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <Button
                  style={{ background: "var(--sf-violet)", color: "#fff" }}
                  disabled={!depositAmount || depositHook.step !== "idle"}
                  onClick={async () => {
                    const ok = await depositHook.requestDeposit(fundId, depositAmount);
                    if (ok) setDepositAmount("");
                  }}
                >
                  {depositHook.step === "idle" || depositHook.step === "error" || depositHook.step === "confirmed"
                    ? "Deposit"
                    : depositHook.step === "encrypting"
                    ? "Encrypting..."
                    : "Submitting..."}
                </Button>
                {depositHook.error && <p className="text-sm text-red-400">{depositHook.error}</p>}
                {depositHook.step === "confirmed" && (
                  <p className="text-sm text-emerald-400">Deposited! Shares minted and credited to your address.</p>
                )}
              </div>
            )}

            {activeTab === "redeem" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-muted">
                  Redemption is always available. Decrypt your balance first to know your shares.
                </p>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Shares to redeem"
                  className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-400"
                  style={{ borderColor: "var(--sf-card-border)" }}
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                />
                <Button
                  variant="outline"
                  style={{ borderColor: "var(--sf-violet-border)", color: "var(--sf-violet-text)" }}
                  disabled={!redeemAmount || redeemHook.step !== "idle"}
                  onClick={async () => {
                    const ok = await redeemHook.requestRedeem(fundId, redeemAmount);
                    if (ok) setRedeemAmount("");
                  }}
                >
                  {redeemHook.step === "idle" || redeemHook.step === "error" || redeemHook.step === "confirmed"
                    ? "Request Redeem"
                    : redeemHook.step === "encrypting"
                    ? "Encrypting..."
                    : "Submitting..."}
                </Button>
                {redeemHook.error && <p className="text-sm text-red-400">{redeemHook.error}</p>}
                {redeemHook.step === "confirmed" && (
                  <p className="text-sm text-emerald-400">Redeem submitted! If the fund had no capital deployed, it settled atomically — otherwise the manager will process it after pulling liquidity.</p>
                )}
              </div>
            )}

            {activeTab === "claim" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-muted">
                  The manager processed your redemption. Click Claim to receive your cUSDC.
                </p>
                <Button
                  style={{ background: "var(--sf-violet)", color: "#fff" }}
                  disabled={claimHook.step !== "idle"}
                  onClick={() => claimHook.claimRedemption(fundId)}
                >
                  {claimHook.step === "idle" || claimHook.step === "error" || claimHook.step === "confirmed"
                    ? "Claim cUSDC"
                    : "Claiming..."}
                </Button>
                {claimHook.error && <p className="text-sm text-red-400">{claimHook.error}</p>}
                {claimHook.step === "confirmed" && (
                  <p className="text-sm text-emerald-400">cUSDC claimed successfully!</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isManager && (
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/manager">Manage Fund</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function AllocationBars({
  allocation,
  apys,
}: {
  allocation: [number, number];
  apys?: [number, number];
}) {
  return (
    <div className="flex flex-col gap-2">
      {SLOT_LABELS.map((label, i) => {
        const pct = allocation[i] / 100;
        const apyPct = apys ? (apys[i] / 100).toFixed(2) : null;
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium" style={{ color: SLOT_COLORS[i] }}>
              {label}
            </span>
            <div className="flex-1 rounded-full bg-surface" style={{ height: 8 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: SLOT_COLORS[i], opacity: 0.85 }}
              />
            </div>
            <span className="w-12 text-right text-xs font-bold text-text-body">
              {pct.toFixed(0)}%
            </span>
            {apyPct && (
              <span className="w-16 text-right text-[10px] text-text-muted">
                {apyPct}% APY
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
