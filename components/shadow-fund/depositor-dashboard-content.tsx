"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFundList } from "@/hooks/use-fund-list";
import { useMyPosition } from "@/hooks/use-my-position";
import { useRequestDeposit } from "@/hooks/use-request-deposit";
import { useRequestRedeem } from "@/hooks/use-request-redeem";
import { useClaimRedemption } from "@/hooks/use-claim-redemption";
import { DepositorPositionCard } from "@/components/shadow-fund/depositor-position-card";
import { truncateAddress } from "@/lib/utils";
import type { FundMetadata } from "@/hooks/use-fund-list";
import Link from "next/link";

export function DepositorDashboardContent() {
  const { address } = useAccount();
  const { funds, isLoading } = useFundList();

  if (!address) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-text-body">Connect your wallet to view your positions.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text-heading md:text-3xl">
          My Positions
        </h1>
        <p className="mt-1 text-text-body">
          Your position sizes are encrypted on-chain — the fund manager and
          other depositors cannot see how much you contributed.
        </p>
      </div>

      {/* Privacy callout */}
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
        style={{
          background: "var(--sf-card-bg)",
          border: "1px solid var(--sf-card-border)",
        }}
      >
        <span className="mt-0.5 text-base">🔒</span>
        <p className="text-text-body">
          Your balances are encrypted on-chain using iExec Nox. Click{" "}
          <strong className="text-text-heading">Decrypt Balance</strong> to see your
          position — this is a gasless client-side operation. No one else can see your amount.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : funds.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-16 text-center"
          style={{ borderColor: "var(--sf-card-border)" }}>
          <span className="text-4xl">🏦</span>
          <p className="font-semibold text-text-heading">No funds to deposit into yet</p>
          <Button asChild style={{ background: "var(--sf-violet)", color: "#fff" }}>
            <Link href="/funds">Browse Funds</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {funds.map((fund) => (
            <DepositorFundRow key={fund.fundId.toString()} fund={fund} />
          ))}
        </div>
      )}
    </div>
  );
}

function DepositorFundRow({ fund }: { fund: FundMetadata }) {
  const { position, decrypting, decryptBalance, decryptError } = useMyPosition(fund.fundId);
  const depositHook = useRequestDeposit();
  const redeemHook = useRequestRedeem();
  const claimHook = useClaimRedemption();

  const [depositAmount, setDepositAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  return (
    <Card
      className="rounded-2xl border"
      style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
    >
      <CardHeader className="px-5 pt-5 pb-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text-heading">{fund.name}</h3>
            <p className="text-xs text-text-muted">
              by {truncateAddress(fund.manager)} · Fund #{fund.fundId.toString()}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {position.hasPendingRedeem && (
              <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                Redeem Pending
              </span>
            )}
            {position.isClaimable && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                Ready to Claim
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 py-4">
        <div className="mb-4">
          <DepositorPositionCard fundId={fund.fundId} fundName={fund.name} />
        </div>

        {/* Balance row */}
        <div
          className="mb-4 flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
        >
          <span className="text-sm text-text-muted">Your Balance</span>
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
              {decrypting ? "Decrypting..." : "Decrypt"}
            </Button>
          </div>
        </div>
        {decryptError && (
          <p className="mb-3 text-xs text-red-400">{decryptError}</p>
        )}

        {/* Deposit form */}
        {showDeposit && (
          <div className="mb-3 flex flex-col gap-2">
            <p className="text-xs text-text-muted">
              Make sure you have cUSDC first. Wrap USDC on the{" "}
              <Link href="/dashboard" className="underline underline-offset-2" style={{ color: "var(--sf-violet-text)" }}>
                Dashboard
              </Link>
              .
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount (USDC)"
                className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-400"
                style={{ borderColor: "var(--sf-card-border)" }}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Button
                size="sm"
                style={{ background: "var(--sf-violet)", color: "#fff" }}
                disabled={!depositAmount || depositHook.step !== "idle"}
                onClick={async () => {
                  const ok = await depositHook.requestDeposit(fund.fundId, depositAmount);
                  if (ok) { setDepositAmount(""); setShowDeposit(false); }
                }}
              >
                {depositHook.step === "idle" || depositHook.step === "confirmed" || depositHook.step === "error"
                  ? "Deposit"
                  : depositHook.step === "encrypting"
                  ? "Encrypting..."
                  : "Depositing..."}
              </Button>
            </div>
            {depositHook.error && <p className="text-xs text-red-400">{depositHook.error}</p>}
          </div>
        )}

        {/* Redeem form */}
        {showRedeem && (
          <div className="mb-3 flex flex-col gap-2">
            <p className="text-xs text-text-muted">
              Redeem is always available regardless of reveal status.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Shares to redeem"
                className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-400"
                style={{ borderColor: "var(--sf-card-border)" }}
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                style={{ borderColor: "var(--sf-violet-border)", color: "var(--sf-violet-text)" }}
                disabled={!redeemAmount || redeemHook.step !== "idle"}
                onClick={async () => {
                  const ok = await redeemHook.requestRedeem(fund.fundId, redeemAmount);
                  if (ok) { setRedeemAmount(""); setShowRedeem(false); }
                }}
              >
                {redeemHook.step === "idle" || redeemHook.step === "confirmed" || redeemHook.step === "error"
                  ? "Request Redeem"
                  : redeemHook.step === "encrypting"
                  ? "Encrypting..."
                  : "Submitting..."}
              </Button>
            </div>
            {redeemHook.error && <p className="text-xs text-red-400">{redeemHook.error}</p>}
          </div>
        )}

        {/* Claim — one click once manager has processed the redeem */}
        {showClaim && (
          <div className="mb-3 flex flex-col gap-2">
            <p className="text-xs text-text-muted">
              Your redemption is ready. Click to receive your cUSDC.
            </p>
            <Button
              size="sm"
              style={{ background: "var(--sf-violet)", color: "#fff" }}
              disabled={claimHook.step !== "idle"}
              onClick={async () => {
                const ok = await claimHook.claimRedemption(fund.fundId);
                if (ok) setShowClaim(false);
              }}
            >
              {claimHook.step === "idle" || claimHook.step === "confirmed" || claimHook.step === "error"
                ? "Claim cUSDC"
                : "Claiming..."}
            </Button>
            {claimHook.error && <p className="text-xs text-red-400">{claimHook.error}</p>}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="flex-1 text-sm"
            onClick={() => { setShowDeposit(!showDeposit); setShowRedeem(false); setShowClaim(false); depositHook.reset(); }}
          >
            {showDeposit ? "Cancel" : "Deposit"}
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-sm"
            onClick={() => { setShowRedeem(!showRedeem); setShowDeposit(false); setShowClaim(false); redeemHook.reset(); }}
          >
            {showRedeem ? "Cancel" : "Withdraw"}
          </Button>
          {position.isClaimable && (
            <Button
              className="flex-1 text-sm"
              style={{ background: "var(--sf-violet)", color: "#fff" }}
              onClick={() => { setShowClaim(!showClaim); setShowDeposit(false); setShowRedeem(false); claimHook.reset(); }}
            >
              {showClaim ? "Cancel" : "Claim cUSDC"}
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="text-sm"
            style={{ borderColor: "var(--sf-card-border)" }}
          >
            <Link href={`/fund/${fund.fundId}`}>Details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
