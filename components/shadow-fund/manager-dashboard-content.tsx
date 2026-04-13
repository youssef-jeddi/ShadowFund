"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StrategySliders } from "@/components/shadow-fund/strategy-sliders";
import { useFundList } from "@/hooks/use-fund-list";
import { useCreateFund } from "@/hooks/use-create-fund";
import { useSetStrategy } from "@/hooks/use-set-strategy";
import { useProcessDeposit } from "@/hooks/use-process-deposit";
import { useProcessRedeem } from "@/hooks/use-process-redeem";
import { truncateAddress } from "@/lib/utils";
import type { StrategyAllocation } from "@/hooks/use-set-strategy";
import type { FundMetadata } from "@/hooks/use-fund-list";
import Link from "next/link";

const DEFAULT_ALLOCATION: StrategyAllocation = { eth: 25, btc: 25, link: 25, usdc: 25 };

export function ManagerDashboardContent() {
  const { address } = useAccount();
  const { funds, isLoading } = useFundList();
  const createFundHook = useCreateFund();
  const setStrategyHook = useSetStrategy();
  const processDeposit = useProcessDeposit();
  const processRedeem = useProcessRedeem();

  // My funds = funds where I'm manager
  const myFunds = funds.filter(
    (f) => f.manager.toLowerCase() === address?.toLowerCase(),
  );

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [fundName, setFundName] = useState("");
  const [description, setDescription] = useState("");
  const [feeBps, setFeeBps] = useState("1000"); // 10%

  // Strategy form state per fund
  const [strategyFundId, setStrategyFundId] = useState<bigint | null>(null);
  const [allocation, setAllocation] = useState<StrategyAllocation>(DEFAULT_ALLOCATION);

  const handleCreate = useCallback(async () => {
    const id = await createFundHook.createFund(fundName, description, Number(feeBps));
    if (id !== null) {
      setShowCreate(false);
      setFundName("");
      setDescription("");
    }
  }, [createFundHook, fundName, description, feeBps]);

  const handleSetStrategy = useCallback(async (fundId: bigint) => {
    await setStrategyHook.setStrategy(fundId, allocation);
    setStrategyFundId(null);
    setAllocation(DEFAULT_ALLOCATION);
  }, [setStrategyHook, allocation]);

  if (!address) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-text-body">Connect your wallet to manage funds.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading md:text-3xl">
            Manager Dashboard
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {truncateAddress(address)}
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          style={{ background: "var(--sf-violet)", color: "#fff" }}
        >
          {showCreate ? "Cancel" : "Create Fund"}
        </Button>
      </div>

      {/* Create fund form */}
      {showCreate && (
        <Card
          className="rounded-2xl border"
          style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
        >
          <CardHeader className="px-5 pt-5 pb-0">
            <h2 className="text-base font-semibold text-text-heading">New Fund</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-5 py-4">
            <Field label="Fund Name">
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
                style={{ borderColor: "var(--sf-card-border)" }}
                placeholder="e.g. Crypto Bull Fund"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
              />
            </Field>
            <Field label="Description">
              <textarea
                className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
                style={{ borderColor: "var(--sf-card-border)" }}
                placeholder="Short description of your strategy"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label={`Performance Fee (basis points — ${(Number(feeBps) / 100).toFixed(2)}%)`}>
              <input
                type="number"
                min={0}
                max={5000}
                step={100}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
                style={{ borderColor: "var(--sf-card-border)" }}
                value={feeBps}
                onChange={(e) => setFeeBps(e.target.value)}
              />
              <p className="mt-1 text-xs text-text-muted">Display-only — not deducted on-chain.</p>
            </Field>
            <Button
              onClick={handleCreate}
              disabled={!fundName || createFundHook.step === "writing"}
              className="self-end"
              style={{ background: "var(--sf-violet)", color: "#fff" }}
            >
              {createFundHook.step === "writing" ? "Creating..." : "Create Fund"}
            </Button>
            {createFundHook.error && (
              <p className="text-sm text-red-400">{createFundHook.error}</p>
            )}
            {createFundHook.step === "confirmed" && (
              <p className="text-sm text-emerald-400">
                Fund created! ID: {createFundHook.fundId?.toString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* My funds */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : myFunds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center"
          style={{ borderColor: "var(--sf-card-border)" }}>
          <span className="text-4xl">🌑</span>
          <p className="font-semibold text-text-heading">No funds yet</p>
          <p className="text-sm text-text-muted">Create your first confidential fund above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {myFunds.map((fund) => (
            <ManagerFundCard
              key={fund.fundId.toString()}
              fund={fund}
              isSettingStrategy={strategyFundId === fund.fundId}
              allocation={allocation}
              onSetAllocation={setAllocation}
              onOpenStrategy={() => {
                setStrategyFundId(fund.fundId);
                setAllocation(DEFAULT_ALLOCATION);
              }}
              onCancelStrategy={() => setStrategyFundId(null)}
              onSubmitStrategy={() => handleSetStrategy(fund.fundId)}
              strategyStep={setStrategyHook.step}
              strategyError={setStrategyHook.error}
              processDepositHook={processDeposit}
              processRedeemHook={processRedeem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ManagerFundCard({
  fund,
  isSettingStrategy,
  allocation,
  onSetAllocation,
  onOpenStrategy,
  onCancelStrategy,
  onSubmitStrategy,
  strategyStep,
  strategyError,
  processDepositHook,
  processRedeemHook,
}: {
  fund: FundMetadata;
  isSettingStrategy: boolean;
  allocation: StrategyAllocation;
  onSetAllocation: (a: StrategyAllocation) => void;
  onOpenStrategy: () => void;
  onCancelStrategy: () => void;
  onSubmitStrategy: () => void;
  strategyStep: string;
  strategyError: string | null;
  processDepositHook: ReturnType<typeof useProcessDeposit>;
  processRedeemHook: ReturnType<typeof useProcessRedeem>;
}) {
  const [processAddr, setProcessAddr] = useState("");

  return (
    <Card
      className="rounded-2xl border"
      style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
    >
      <CardHeader className="px-5 pt-5 pb-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text-heading">{fund.name}</h3>
            <p className="text-xs text-text-muted">Fund #{fund.fundId.toString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {fund.revealed ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                Revealed
              </span>
            ) : (
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-text-muted">
                Sealed
              </span>
            )}
            {fund.strategySet && !fund.revealed && (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: "var(--sf-violet-subtle)", color: "var(--sf-violet-text)" }}
              >
                Strategy Set 🔒
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 py-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-text-muted">
            Depositors: <strong className="text-text-body">{fund.depositorCount.toString()}</strong>
          </span>
          <span className="text-text-muted">
            Fee: <strong className="text-text-body">{(Number(fund.performanceFeeBps) / 100).toFixed(2)}%</strong>
          </span>
        </div>

        {/* Strategy section */}
        {!fund.revealed && (
          <div className="mt-4 flex flex-col gap-3">
            {isSettingStrategy ? (
              <>
                <StrategySliders
                  value={allocation}
                  onChange={onSetAllocation}
                  disabled={strategyStep !== "idle" && strategyStep !== "confirmed" && strategyStep !== "error"}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-sm"
                    onClick={onCancelStrategy}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 text-sm"
                    style={{ background: "var(--sf-violet)", color: "#fff" }}
                    disabled={
                      allocation.eth + allocation.btc + allocation.link + allocation.usdc !== 100
                      || (strategyStep !== "idle" && strategyStep !== "error" && strategyStep !== "confirmed")
                    }
                    onClick={onSubmitStrategy}
                  >
                    {strategyStep.startsWith("encrypting")
                      ? `Encrypting ${strategyStep.split("_")[1]?.toUpperCase()}...`
                      : strategyStep === "writing"
                      ? "Submitting..."
                      : strategyStep === "confirmed"
                      ? "Strategy Set ✓"
                      : fund.strategySet
                      ? "Rebalance"
                      : "Submit Strategy"}
                  </Button>
                </div>
                {strategyError && (
                  <p className="text-sm text-red-400">{strategyError}</p>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                className="text-sm"
                style={{ borderColor: "var(--sf-violet-border)", color: "var(--sf-violet-text)" }}
                onClick={onOpenStrategy}
              >
                {fund.strategySet ? "Rebalance Strategy" : "Set Strategy"}
              </Button>
            )}
          </div>
        )}

        {/* Process deposits/redemptions */}
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Process Pending Requests
          </p>
          <input
            className="rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
            style={{ borderColor: "var(--sf-card-border)" }}
            placeholder="User address (0x...)"
            value={processAddr}
            onChange={(e) => setProcessAddr(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              disabled={!processAddr || processDepositHook.step === "writing"}
              onClick={() =>
                processDepositHook.processDeposit(fund.fundId, processAddr as `0x${string}`)
              }
            >
              {processDepositHook.step === "writing" ? "Processing..." : "Process Deposit"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              disabled={!processAddr || processRedeemHook.step === "writing"}
              onClick={() =>
                processRedeemHook.processRedeem(fund.fundId, processAddr as `0x${string}`)
              }
            >
              {processRedeemHook.step === "writing" ? "Processing..." : "Process Redeem"}
            </Button>
          </div>
          {(processDepositHook.error || processRedeemHook.error) && (
            <p className="text-sm text-red-400">
              {processDepositHook.error ?? processRedeemHook.error}
            </p>
          )}
        </div>

        {/* Reveal link */}
        {!fund.revealed && fund.strategySet && (
          <div className="mt-4 border-t pt-4"
            style={{ borderColor: "var(--sf-card-border)" }}>
            <Link
              href={`/fund/${fund.fundId}/reveal`}
              className="text-sm font-medium underline underline-offset-2"
              style={{ color: "var(--sf-violet-text)" }}
            >
              Reveal Strategy →
            </Link>
            <p className="mt-0.5 text-xs text-text-muted">
              This is irreversible. Make sure you&apos;re ready.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-muted">{label}</label>
      {children}
    </div>
  );
}
