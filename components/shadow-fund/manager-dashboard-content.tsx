"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS, ZERO_HANDLE } from "@/lib/contracts";
import { useHandleClient } from "@/hooks/use-handle-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StrategySliders,
  type StrategyAllocation,
} from "@/components/shadow-fund/strategy-sliders";
import { UpdateAllocationModal } from "@/components/shadow-fund/update-allocation-modal";
import { ChainGptAnalysisPanel } from "@/components/shadow-fund/chaingpt-analysis-panel";
import { useFundList } from "@/hooks/use-fund-list";
import { useFund } from "@/hooks/use-fund";
import { useCreateFund } from "@/hooks/use-create-fund";
import { useProcessRedeem } from "@/hooks/use-process-redeem";
import { useDeployCapital } from "@/hooks/use-deploy-capital";
import { useWithdrawCapital } from "@/hooks/use-withdraw-capital";
import { useSubVaultMetrics } from "@/hooks/use-subvault-metrics";
import { useChainGptAnalysis } from "@/hooks/use-chaingpt-analysis";
import { truncateAddress } from "@/lib/utils";
import type { FundMetadata } from "@/hooks/use-fund-list";

const DEFAULT_ALLOCATION: StrategyAllocation = {
  aaveUsdcBps: 6000,
  fixedBps: 4000,
};

const SLOT_LABELS = ["Aave USDC", "Fixed 8%"] as const;
const SLOT_COLORS = ["#10b981", "#f59e0b"] as const;

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

export function ManagerDashboardContent() {
  const { address } = useAccount();
  const { funds, isLoading } = useFundList();
  const createFundHook = useCreateFund();

  const myFunds = funds.filter(
    (f) => f.manager.toLowerCase() === address?.toLowerCase(),
  );

  const [showCreate, setShowCreate] = useState(false);
  const [fundName, setFundName] = useState("");
  const [description, setDescription] = useState("");
  const [feeBps, setFeeBps] = useState("1000");
  const [newAllocation, setNewAllocation] =
    useState<StrategyAllocation>(DEFAULT_ALLOCATION);

  const allocationValid =
    newAllocation.aaveUsdcBps + newAllocation.fixedBps === 10_000;

  const handleCreate = useCallback(async () => {
    const id = await createFundHook.createFund(
      fundName,
      description,
      Number(feeBps),
      [newAllocation.aaveUsdcBps, newAllocation.fixedBps],
    );
    if (id !== null) {
      setShowCreate(false);
      setFundName("");
      setDescription("");
      setNewAllocation(DEFAULT_ALLOCATION);
    }
  }, [createFundHook, fundName, description, feeBps, newAllocation]);

  if (!address) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-text-body">Connect your wallet to manage funds.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading md:text-3xl">
            Manager Dashboard
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {truncateAddress(address)} · Strategy is public · Depositor positions are private
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          style={{ background: "var(--sf-violet)", color: "#fff" }}
        >
          {showCreate ? "Cancel" : "Create Fund"}
        </Button>
      </div>

      {showCreate && (
        <Card
          className="rounded-2xl border"
          style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
        >
          <CardHeader className="px-5 pt-5 pb-0">
            <h2 className="text-base font-semibold text-text-heading">New Fund</h2>
            <p className="text-xs text-text-muted mt-1">
              Pick a public 2-way allocation between Aave USDC and the Fixed 8% pool.
              You can change it any time (until a deploy is mid-flight).
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-5 py-4">
            <Field label="Fund Name">
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
                style={{ borderColor: "var(--sf-card-border)" }}
                placeholder="e.g. Shadow Alpha Fund"
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
            <Field label="Allocation (public)">
              <StrategySliders value={newAllocation} onChange={setNewAllocation} />
            </Field>
            <Button
              onClick={handleCreate}
              disabled={!fundName || !allocationValid || createFundHook.step === "writing"}
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

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : myFunds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center"
          style={{ borderColor: "var(--sf-card-border)" }}>
          <span className="text-4xl">🌑</span>
          <p className="font-semibold text-text-heading">No funds yet</p>
          <p className="text-sm text-text-muted">Create your first fund above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {myFunds.map((fund) => (
            <ManagerFundSection key={fund.fundId.toString()} fund={fund} />
          ))}
        </div>
      )}
    </div>
  );
}

function ManagerFundSection({ fund }: { fund: FundMetadata }) {
  const { fund: detail } = useFund(fund.fundId);
  const { metrics } = useSubVaultMetrics(fund.fundId);
  const chainGpt = useChainGptAnalysis();

  const [aaveBps, fixedBps] = fund.allocationBps;
  const blendedApyBps =
    (aaveBps * metrics.apys[0] + fixedBps * metrics.apys[1]) / 10_000;
  const blendedApyPct = (blendedApyBps / 100).toFixed(2);

  const fundAgeHours = Math.floor(
    (Date.now() / 1000 - Number(fund.createdAt)) / 3600,
  );
  const totalTvlUsdc =
    Number(formatUnits(detail?.totalDeployed ?? 0n, 6));

  const runAnalyze = useCallback(() => {
    chainGpt.analyze({
      fundName: fund.name,
      allocationBps: [aaveBps, fixedBps],
      subVaultAPYs: metrics.apys,
      totalDeployedUsdc: Number(formatUnits(metrics.totalDeployed, 6)),
      totalTvlUsdc,
      depositorCount: Number(fund.depositorCount),
      fundAgeHours,
    });
  }, [
    chainGpt,
    fund.name,
    aaveBps,
    fixedBps,
    metrics.apys,
    metrics.totalDeployed,
    totalTvlUsdc,
    fund.depositorCount,
    fundAgeHours,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text-heading">{fund.name}</h2>
          <p className="text-xs text-text-muted">
            Fund #{fund.fundId.toString()} · {fund.depositorCount.toString()} depositors ·{" "}
            {(Number(fund.performanceFeeBps) / 100).toFixed(2)}% fee
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            background: "var(--sf-violet-subtle)",
            color: "var(--sf-violet-text)",
          }}
        >
          Strategy public · Positions private
        </span>
      </div>

      <FundOverviewCard fund={fund} blendedApyPct={blendedApyPct} />
      <FundActionsCard fund={fund} />
      <ChainGptAnalysisPanel
        analysis={chainGpt.analysis}
        isLoading={chainGpt.isLoading}
        error={chainGpt.error}
        onAnalyze={runAnalyze}
        vaultAddress={vaultAddress}
      />
    </div>
  );
}

function FundOverviewCard({
  fund,
  blendedApyPct,
}: {
  fund: FundMetadata;
  blendedApyPct: string;
}) {
  const { handleClient } = useHandleClient();
  const { metrics } = useSubVaultMetrics(fund.fundId);

  const { data: totalAssetsHandle } = useReadContract({
    address: vaultAddress,
    abi: shadowFundVaultAbi,
    functionName: "getFundTotalAssets",
    args: [fund.fundId],
    query: { enabled: !!vaultAddress, refetchInterval: 15_000 },
  });

  const [tvlDecrypted, setTvlDecrypted] = useState<bigint | null>(null);
  const [tvlDecrypting, setTvlDecrypting] = useState(false);
  const [tvlError, setTvlError] = useState<string | null>(null);

  const decryptTvl = useCallback(async () => {
    if (!handleClient) {
      setTvlError("Handle client not ready");
      return;
    }
    const handle = totalAssetsHandle as `0x${string}` | undefined;
    if (!handle || handle === ZERO_HANDLE) {
      setTvlDecrypted(0n);
      return;
    }
    setTvlDecrypting(true);
    setTvlError(null);
    try {
      const result = await handleClient.decrypt(handle);
      const raw = (result as { value?: unknown })?.value ?? result;
      const value = typeof raw === "bigint" ? raw : BigInt(String(raw));
      setTvlDecrypted(value);
    } catch (err) {
      setTvlError(err instanceof Error ? err.message : "Decryption failed");
    } finally {
      setTvlDecrypting(false);
    }
  }, [handleClient, totalAssetsHandle]);

  const [aaveBps, fixedBps] = fund.allocationBps;

  return (
    <SectionCard title="Fund Overview" subtitle="Public strategy · Encrypted aggregates (manager-only decrypt)">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Stat label="Depositors" value={fund.depositorCount.toString()} />
          <Stat
            label="Deployed"
            value={`${formatUnits(metrics.totalDeployed, 6)} USDC`}
          />
          <Stat label="Blended APY" value={`${blendedApyPct}%`} />
          <div
            className="flex items-center justify-between rounded-xl border px-3 py-2"
            style={{
              borderColor: "var(--sf-violet-border)",
              background: "var(--sf-violet-subtle)",
            }}
          >
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-text-muted">
                Fund TVL (encrypted — manager only)
              </span>
              <span className="text-xs font-semibold text-text-heading">
                {tvlDecrypted !== null
                  ? `${formatUnits(tvlDecrypted, 6)} cUSDC`
                  : "●●●●●"}
              </span>
              {tvlError && <span className="text-[10px] text-red-400">{tvlError}</span>}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              style={{ borderColor: "var(--sf-violet-border)", color: "var(--sf-violet-text)" }}
              disabled={tvlDecrypting}
              onClick={decryptTvl}
            >
              {tvlDecrypting ? "..." : "Decrypt"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wide text-text-muted">
            Allocation (public)
          </span>
          <AllocationBars allocation={[aaveBps, fixedBps]} apys={metrics.apys} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SLOT_LABELS.map((label, i) => (
              <div
                key={label}
                className="flex flex-col gap-0.5 rounded-xl px-3 py-2"
                style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
              >
                <span className="text-[10px] uppercase tracking-wide text-text-muted">
                  {label}
                </span>
                <span className="text-xs font-medium" style={{ color: SLOT_COLORS[i] }}>
                  {(metrics.apys[i] / 100).toFixed(2)}% APY
                </span>
                <span className="text-[10px] text-text-muted">
                  Deployed: {formatUnits(metrics.values[i], 6)} USDC
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function FundActionsCard({ fund }: { fund: FundMetadata }) {
  const { metrics } = useSubVaultMetrics(fund.fundId);
  const deployHook = useDeployCapital(fund.fundId);
  const withdrawHook = useWithdrawCapital();
  const processRedeem = useProcessRedeem();

  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [deployAmt, setDeployAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [processAddr, setProcessAddr] = useState("");

  const pendingAmt = deployHook.pendingAmount ?? 0n;
  const hasPending = pendingAmt > 0n;
  const deployBusy =
    deployHook.step !== "idle" && deployHook.step !== "error" && deployHook.step !== "confirmed";

  const maxWithdraw = metrics.totalDeployed;

  return (
    <SectionCard
      title="Actions"
      subtitle="Update allocation · Deploy capital · Withdraw · Process redemptions"
    >
      {showAllocationModal && (
        <UpdateAllocationModal
          fundId={fund.fundId}
          currentBps={fund.allocationBps}
          onClose={() => setShowAllocationModal(false)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Update Allocation */}
        <ActionBlock
          title="Update Allocation"
          subtitle="Adjusts future deploys. Blocked while a deploy is pending."
        >
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            style={{ borderColor: "var(--sf-violet-border)", color: "var(--sf-violet-text)" }}
            onClick={() => setShowAllocationModal(true)}
          >
            Open Allocation Editor
          </Button>
        </ActionBlock>

        {/* Deploy Capital */}
        <ActionBlock
          title="Deploy Capital"
          subtitle="Bulk unwrap + fan-out to Aave USDC + Fixed pool per allocation."
        >
          {!hasPending ? (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
                style={{ borderColor: "var(--sf-card-border)" }}
                placeholder="USDC amount"
                value={deployAmt}
                onChange={(e) => setDeployAmt(e.target.value)}
                disabled={deployBusy}
              />
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={!deployAmt || !fund.allocationSet || deployBusy}
                onClick={async () => {
                  const ok = await deployHook.deploy(fund.fundId, deployAmt);
                  if (ok) setDeployAmt("");
                }}
              >
                {deployHook.step === "initiating"
                  ? "Initiating..."
                  : deployHook.step === "cooldown"
                  ? "TEE Cooldown..."
                  : deployHook.step === "decrypting"
                  ? "Decrypting..."
                  : deployHook.step === "finalizing"
                  ? "Finalizing..."
                  : "Deploy"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-3 py-2">
              <div className="flex flex-col">
                <span className="text-xs text-amber-400">
                  Pending deploy: {formatUnits(pendingAmt, 6)} USDC
                </span>
                <span className="text-[10px] text-text-muted">
                  TEE cooldown — retry finalize to fan out
                </span>
              </div>
              <Button
                size="sm"
                className="text-xs"
                style={{ background: "var(--sf-violet)", color: "#fff" }}
                disabled={deployBusy}
                onClick={() => deployHook.retryFinalize(fund.fundId)}
              >
                {deployHook.step === "decrypting"
                  ? "Decrypting..."
                  : deployHook.step === "finalizing"
                  ? "Finalizing..."
                  : "Finalize Deploy"}
              </Button>
            </div>
          )}
          {deployHook.error && <p className="text-xs text-red-400">{deployHook.error}</p>}
        </ActionBlock>

        {/* Withdraw Capital */}
        <ActionBlock
          title="Withdraw Capital"
          subtitle={`Pulls USDC back from sub-vaults, rewraps as cUSDC. Max: ${formatUnits(maxWithdraw, 6)} USDC`}
        >
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
              style={{ borderColor: "var(--sf-card-border)" }}
              placeholder="USDC amount"
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
              disabled={withdrawHook.step === "writing"}
            />
            {maxWithdraw > 0n && (
              <Button
                size="sm"
                variant="outline"
                className="px-2 text-[10px]"
                disabled={withdrawHook.step === "writing"}
                onClick={() => setWithdrawAmt(formatUnits(maxWithdraw, 6))}
              >
                Max
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={!withdrawAmt || withdrawHook.step === "writing"}
              onClick={async () => {
                const ok = await withdrawHook.withdraw(fund.fundId, withdrawAmt);
                if (ok) setWithdrawAmt("");
              }}
            >
              {withdrawHook.step === "writing" ? "Withdrawing..." : "Withdraw"}
            </Button>
          </div>
          {withdrawHook.error && <p className="text-xs text-red-400">{withdrawHook.error}</p>}
        </ActionBlock>

        {/* Process Pending Redeem */}
        <ActionBlock
          title="Process Pending Redeem"
          subtitle="Only needed when capital is deployed. Withdraw Capital first."
        >
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
              style={{ borderColor: "var(--sf-card-border)" }}
              placeholder="User address (0x...)"
              value={processAddr}
              onChange={(e) => setProcessAddr(e.target.value)}
              disabled={processRedeem.step === "writing"}
            />
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={!processAddr || processRedeem.step === "writing"}
              onClick={() =>
                processRedeem.processRedeem(fund.fundId, processAddr as `0x${string}`)
              }
            >
              {processRedeem.step === "writing" ? "Processing..." : "Process Redeem"}
            </Button>
          </div>
          {processRedeem.error && <p className="text-xs text-red-400">{processRedeem.error}</p>}
        </ActionBlock>
      </div>
    </SectionCard>
  );
}

function AllocationBars({
  allocation,
  apys,
}: {
  allocation: [number, number];
  apys: [number, number];
}) {
  return (
    <div className="flex flex-col gap-2">
      {SLOT_LABELS.map((label, i) => {
        const pct = allocation[i] / 100;
        const apyPct = (apys[i] / 100).toFixed(2);
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium" style={{ color: SLOT_COLORS[i] }}>
              {label}
            </span>
            <div className="flex-1 rounded-full bg-surface" style={{ height: 8 }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: SLOT_COLORS[i], opacity: 0.85 }}
              />
            </div>
            <span className="w-12 text-right text-xs font-bold text-text-body">
              {pct.toFixed(0)}%
            </span>
            <span className="w-16 text-right text-[10px] text-text-muted">{apyPct}% APY</span>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className="rounded-2xl border"
      style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
    >
      <CardHeader className="px-5 pt-5 pb-0">
        <h3 className="text-base font-semibold text-text-heading">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </CardHeader>
      <CardContent className="px-5 py-4">{children}</CardContent>
    </Card>
  );
}

function ActionBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border px-4 py-3"
      style={{ borderColor: "var(--sf-card-border)" }}
    >
      <p className="text-xs font-semibold text-text-heading">{title}</p>
      <p className="text-[11px] text-text-muted">{subtitle}</p>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
      style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
    >
      <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-text-heading">{value}</span>
    </div>
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
