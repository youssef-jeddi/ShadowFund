"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS, ZERO_HANDLE } from "@/lib/contracts";
import { useHandleClient } from "@/hooks/use-handle-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StrategySliders } from "@/components/shadow-fund/strategy-sliders";
import { useFundList } from "@/hooks/use-fund-list";
import { useCreateFund } from "@/hooks/use-create-fund";
import { useSetStrategy } from "@/hooks/use-set-strategy";
import { useProcessRedeem } from "@/hooks/use-process-redeem";
import { useInitiateSupply } from "@/hooks/use-initiate-supply";
import { useFinalizeSupply } from "@/hooks/use-finalize-supply";
import { useWithdrawFromAave } from "@/hooks/use-withdraw-from-aave";
import { useFundYield } from "@/hooks/use-fund-yield";
import { formatUnits } from "viem";
import { truncateAddress } from "@/lib/utils";
import type { StrategyAllocation } from "@/hooks/use-set-strategy";
import type { FundMetadata } from "@/hooks/use-fund-list";
import Link from "next/link";

const DEFAULT_ALLOCATION: StrategyAllocation = { wethBps: 5000 };

export function ManagerDashboardContent() {
  const { address } = useAccount();
  const { funds, isLoading } = useFundList();
  const createFundHook = useCreateFund();
  const setStrategyHook = useSetStrategy();
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
                      allocation.wethBps < 0 || allocation.wethBps > 10_000
                      || (strategyStep !== "idle" && strategyStep !== "error" && strategyStep !== "confirmed")
                    }
                    onClick={onSubmitStrategy}
                  >
                    {strategyStep === "encrypting"
                      ? "Encrypting..."
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

        {/* Process pending redeems — only needed when the fast path was skipped
            (fund has capital in Aave and a depositor requested a redeem larger
            than the idle liquidity). Deposits are auto-minted in the receiver
            callback, no manager action required. */}
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Process Pending Redeem
          </p>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Only needed when you currently have capital supplied to Aave — small
            redeems auto-settle. After pulling liquidity back from Aave, process
            the queued redeem for each affected user.
          </p>
          <input
            className="rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
            style={{ borderColor: "var(--sf-card-border)" }}
            placeholder="User address (0x...)"
            value={processAddr}
            onChange={(e) => setProcessAddr(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={!processAddr || processRedeemHook.step === "writing"}
            onClick={() =>
              processRedeemHook.processRedeem(fund.fundId, processAddr as `0x${string}`)
            }
          >
            {processRedeemHook.step === "writing" ? "Processing..." : "Process Redeem"}
          </Button>
          {processRedeemHook.error && (
            <p className="text-sm text-red-400">{processRedeemHook.error}</p>
          )}
        </div>

        {/* Aave vault performance + capital deployment */}
        <VaultAaveSection fundId={fund.fundId} />

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

function VaultAaveSection({ fundId }: { fundId: bigint }) {
  const { fundYield } = useFundYield(fundId);
  const initiate = useInitiateSupply();
  const finalize = useFinalizeSupply(fundId);
  const withdraw = useWithdrawFromAave();
  const { handleClient } = useHandleClient();

  const [supplyAmt, setSupplyAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  const principal = fundYield?.principal ?? 0n;
  const aValue = fundYield?.aValue ?? 0n;
  const yieldAmount = fundYield?.yieldAmount ?? 0n;
  const apyPct = fundYield ? (Number(fundYield.apyBps) / 100).toFixed(2) : "—";

  const pendingAmt = finalize.pendingAmount ?? 0n;
  const hasPending = pendingAmt > 0n;

  // ── Manager-only TVL decryption ──────────────────────────────────────────
  // `totalAssets` is encrypted with a manager-only ACL granted on every
  // mutation. We read the handle and let the manager decrypt it client-side
  // via the Nox SDK so they know how much cUSDC the fund currently holds
  // before deciding how much to push to Aave.
  const vaultAddress = ("SHADOW_FUND_VAULT" in CONTRACTS)
    ? (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT
    : undefined;

  const { data: totalAssetsHandle } = useReadContract({
    address: vaultAddress,
    abi: shadowFundVaultAbi,
    functionName: "getFundTotalAssets",
    args: [fundId],
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

  const idleCusdc = tvlDecrypted !== null && tvlDecrypted >= principal
    ? tvlDecrypted - principal
    : null;

  return (
    <div
      className="mt-4 flex flex-col gap-3 rounded-xl border p-3"
      style={{ borderColor: "var(--sf-card-border)", background: "var(--sf-card-inner, transparent)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Aave Vault Performance
        </p>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          Aave v3 · {apyPct}% APY
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Principal" value={`${formatUnits(principal, 6)} USDC`} />
        <Stat label="aValue" value={`${formatUnits(aValue, 6)} USDC`} />
        <Stat
          label="Yield"
          value={`${yieldAmount >= 0n ? "+" : ""}${formatUnits(yieldAmount, 6)}`}
          highlight={yieldAmount > 0n ? "emerald" : undefined}
        />
      </div>

      {/* Manager-only fund TVL (encrypted) */}
      <div
        className="flex items-center justify-between rounded-xl border px-3 py-2"
        style={{ borderColor: "var(--sf-violet-border)", background: "var(--sf-violet-subtle)" }}
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
          {idleCusdc !== null && (
            <span className="text-[10px] text-text-muted">
              Idle (available to supply): {formatUnits(idleCusdc, 6)} cUSDC
            </span>
          )}
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

      {/* Supply */}
      <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--sf-card-border)" }}>
        <p className="text-xs font-semibold text-text-heading">Supply to Aave</p>
        {!hasPending ? (
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
              style={{ borderColor: "var(--sf-card-border)" }}
              placeholder="USDC amount"
              value={supplyAmt}
              onChange={(e) => setSupplyAmt(e.target.value)}
              disabled={initiate.step === "writing"}
            />
            {idleCusdc !== null && idleCusdc > 0n && (
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] px-2"
                disabled={initiate.step === "writing"}
                onClick={() => setSupplyAmt(formatUnits(idleCusdc, 6))}
              >
                Max
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={!supplyAmt || initiate.step === "writing"}
              onClick={async () => {
                const ok = await initiate.initiateSupply(fundId, supplyAmt);
                if (ok) setSupplyAmt("");
              }}
            >
              {initiate.step === "writing" ? "Initiating..." : "1. Initiate"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-xs text-amber-400">
                Pending unwrap: {formatUnits(pendingAmt, 6)} USDC
              </span>
              <span className="text-[10px] text-text-muted">
                TEE cooldown — finalize to supply to Aave
              </span>
            </div>
            <Button
              size="sm"
              className="text-xs"
              style={{ background: "var(--sf-violet)", color: "#fff" }}
              disabled={finalize.step === "decrypting" || finalize.step === "writing"}
              onClick={() => finalize.finalize(fundId)}
            >
              {finalize.step === "decrypting"
                ? "Decrypting..."
                : finalize.step === "writing"
                ? "Supplying..."
                : "2. Finalize → Supply"}
            </Button>
          </div>
        )}
        {initiate.error && <p className="text-xs text-red-400">{initiate.error}</p>}
        {finalize.error && <p className="text-xs text-red-400">{finalize.error}</p>}
      </div>

      {/* Withdraw */}
      <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--sf-card-border)" }}>
        <p className="text-xs font-semibold text-text-heading">Withdraw from Aave</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm text-text-heading outline-none focus:ring-1 focus:ring-violet-400"
            style={{ borderColor: "var(--sf-card-border)" }}
            placeholder="USDC amount (≤ aValue)"
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
            disabled={withdraw.step === "writing"}
          />
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={!withdrawAmt || withdraw.step === "writing"}
            onClick={async () => {
              const ok = await withdraw.withdraw(fundId, withdrawAmt);
              if (ok) setWithdrawAmt("");
            }}
          >
            {withdraw.step === "writing" ? "Withdrawing..." : "Withdraw"}
          </Button>
        </div>
        {withdraw.error && <p className="text-xs text-red-400">{withdraw.error}</p>}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "emerald";
}) {
  return (
    <div className="flex flex-col rounded-lg bg-surface px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
      <span
        className={`text-xs font-semibold ${
          highlight === "emerald" ? "text-emerald-400" : "text-text-heading"
        }`}
      >
        {value}
      </span>
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
