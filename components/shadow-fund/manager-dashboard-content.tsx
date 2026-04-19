"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import Link from "next/link";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS, ZERO_HANDLE } from "@/lib/contracts";
import { useHandleClient } from "@/hooks/use-handle-client";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";
import { SfCard } from "@/components/shadow-fund/primitives/sf-card";
import { SfInput } from "@/components/shadow-fund/primitives/sf-input";
import { StatCell } from "@/components/shadow-fund/primitives/stat-cell";
import { KV } from "@/components/shadow-fund/primitives/kv";
import { Scramble } from "@/components/shadow-fund/primitives/scramble";
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

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

export function ManagerDashboardContent() {
  const { address } = useAccount();
  const { funds, isLoading } = useFundList();
  const createFundHook = useCreateFund();

  const myFunds = funds.filter(
    (f) => f.manager.toLowerCase() === address?.toLowerCase(),
  );

  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [fundName, setFundName] = useState("");
  const [description, setDescription] = useState("");
  const [feeBps, setFeeBps] = useState("1000");
  const [newAllocation, setNewAllocation] = useState<StrategyAllocation>(DEFAULT_ALLOCATION);

  const allocationValid = newAllocation.aaveUsdcBps + newAllocation.fixedBps === 10_000;

  const handleCreate = useCallback(async () => {
    const id = await createFundHook.createFund(
      fundName,
      description,
      Number(feeBps),
      [newAllocation.aaveUsdcBps, newAllocation.fixedBps],
    );
    if (id !== null) {
      setShowCreate(false);
      setCreateStep(0);
      setFundName("");
      setDescription("");
      setNewAllocation(DEFAULT_ALLOCATION);
    }
  }, [createFundHook, fundName, description, feeBps, newAllocation]);

  if (!address) {
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "80px 32px", textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>Connect your wallet to manage funds.</div>
      </div>
    );
  }

  const WIZARD_STEPS = ["Identity", "Strategy", "Economics", "Review"];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "56px 32px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          paddingBottom: 32,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <Eyebrow dot>Manager Console · {truncateAddress(address)}</Eyebrow>
          <h1
            className="display"
            style={{ fontSize: 64, marginTop: 14, letterSpacing: "-0.028em", lineHeight: 1 }}
          >
            Command{" "}
            <span className="display-italic" style={{ color: "var(--pearl)" }}>
              deck
            </span>
          </h1>
        </div>
        <SfButton
          variant="primary"
          onClick={() => {
            setShowCreate(!showCreate);
            setCreateStep(0);
          }}
        >
          {showCreate ? "Cancel" : "+ New Vault"}
        </SfButton>
      </div>

      {/* Vault count */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
        <StatCell label="Your Vaults" value={myFunds.length.toString()} sub="managed by you" last noBorderBottom />
      </div>

      {/* Create wizard */}
      {showCreate && (
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
          <Eyebrow>Manager Console · New Vault</Eyebrow>
          <h2
            className="display"
            style={{ fontSize: 36, marginTop: 12, letterSpacing: "-0.025em", lineHeight: 1 }}
          >
            Launch a{" "}
            <span className="display-italic" style={{ color: "var(--pearl)" }}>
              confidential vault
            </span>
          </h2>
          {/* Step tabs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${WIZARD_STEPS.length}, 1fr)`,
              marginTop: 28,
              background: "var(--border)",
              gap: 1,
            }}
          >
            {WIZARD_STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => i < createStep && setCreateStep(i)}
                style={{
                  padding: "16px 18px",
                  textAlign: "left" as const,
                  background: i === createStep ? "var(--surface-2)" : "var(--surface)",
                  cursor: i < createStep ? "pointer" : "default",
                  border: "none",
                  borderTop: i === createStep ? "2px solid var(--pearl)" : "2px solid transparent",
                }}
              >
                <div
                  className="mono"
                  style={{ fontSize: 10, color: i <= createStep ? "var(--pearl)" : "var(--text-muted)" }}
                >
                  0{i + 1}
                </div>
                <div style={{ fontSize: 13, color: i <= createStep ? "var(--text)" : "var(--text-muted)", marginTop: 4 }}>
                  {s}
                </div>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 40, marginTop: 32 }}>
            <div>
              {createStep === 0 && (
                <div>
                  <h3 className="display" style={{ fontSize: 28 }}>Vault identity</h3>
                  <div style={{ marginBottom: 20, marginTop: 20 }}>
                    <label className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Name</label>
                    <SfInput
                      placeholder="e.g. Shadow Alpha Fund"
                      value={fundName}
                      onChange={(e) => setFundName(e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Description</label>
                    <textarea
                      placeholder="Short description of your strategy"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{
                        width: "100%",
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        padding: "12px 14px",
                        fontSize: 14,
                        color: "var(--text)",
                        outline: "none",
                        borderRadius: 2,
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>
              )}
              {createStep === 1 && (
                <div>
                  <h3 className="display" style={{ fontSize: 28 }}>Strategy</h3>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8, marginBottom: 20 }}>
                    Your strategy is public. Depositors need to know what they&apos;re underwriting.
                  </p>
                  <div
                    style={{
                      padding: 20,
                      background: "var(--bg-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <StrategySliders value={newAllocation} onChange={setNewAllocation} />
                  </div>
                  {!allocationValid && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--red)" }}>
                      Allocation must sum to 100%.
                    </div>
                  )}
                </div>
              )}
              {createStep === 2 && (
                <div>
                  <h3 className="display" style={{ fontSize: 28 }}>Economics</h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 20,
                      marginTop: 20,
                    }}
                  >
                    <div>
                      <label className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
                        Perf fee (bps — {(Number(feeBps) / 100).toFixed(2)}%)
                      </label>
                      <SfInput
                        type="number"
                        min={0}
                        max={5000}
                        step={100}
                        mono
                        value={feeBps}
                        onChange={(e) => setFeeBps(e.target.value)}
                      />
                      <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                        Display-only — not deducted on-chain.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {createStep === 3 && (
                <div>
                  <h3 className="display" style={{ fontSize: 28 }}>Review & deploy</h3>
                  <div style={{ border: "1px solid var(--border)", marginTop: 20 }}>
                    <KV label="Name" value={fundName} />
                    <KV
                      label="Strategy"
                      value={
                        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                          Aave {newAllocation.aaveUsdcBps / 100}% · Fixed {newAllocation.fixedBps / 100}%
                        </span>
                      }
                    />
                    <KV
                      label="Perf fee"
                      value={
                        <span className="mono">{(Number(feeBps) / 100).toFixed(2)}%</span>
                      }
                      last
                    />
                  </div>
                  {createFundHook.error && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--red)" }}>
                      {createFundHook.error}
                    </div>
                  )}
                  {createFundHook.step === "confirmed" && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--green)" }}>
                      Fund created! ID: {createFundHook.fundId?.toString()}
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 32,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <SfButton
                  variant="ghost"
                  onClick={() => (createStep > 0 ? setCreateStep(createStep - 1) : setShowCreate(false))}
                >
                  {createStep > 0 ? "← Back" : "Cancel"}
                </SfButton>
                {createStep < 3 ? (
                  <SfButton
                    variant="primary"
                    disabled={createStep === 1 && !allocationValid}
                    onClick={() => setCreateStep(createStep + 1)}
                  >
                    Continue →
                  </SfButton>
                ) : (
                  <SfButton
                    variant="primary"
                    disabled={!fundName || !allocationValid || createFundHook.step === "writing"}
                    onClick={handleCreate}
                  >
                    {createFundHook.step === "writing" ? "Creating…" : "Deploy Vault"}
                  </SfButton>
                )}
              </div>
            </div>

            {/* Preview card */}
            <SfCard style={{ padding: 24, alignSelf: "start" }}>
              <Eyebrow>Preview</Eyebrow>
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, var(--pearl), var(--pearl-deep))",
                  }}
                />
                <div>
                  <div style={{ fontSize: 14 }}>{fundName || "Untitled Vault"}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    manager · {truncateAddress(address)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="eyebrow">Strategy · public</div>
                <div className="mono" style={{ fontSize: 11, marginTop: 6, color: "var(--text-dim)" }}>
                  Aave {newAllocation.aaveUsdcBps / 100}% · Fixed {newAllocation.fixedBps / 100}%
                </div>
              </div>
            </SfCard>
          </div>
        </div>
      )}

      {/* Fund list */}
      <div style={{ marginTop: 48 }}>
        {isLoading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading funds…</div>
        ) : myFunds.length === 0 ? (
          <div
            style={{
              padding: "64px 32px",
              textAlign: "center",
              border: "1px dashed var(--border)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 16, color: "var(--text-muted)" }}>◉</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No funds yet</div>
            <div style={{ color: "var(--text-muted)", marginBottom: 24 }}>
              Create your first confidential fund above.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {myFunds.map((fund) => (
              <ManagerFundSection key={fund.fundId.toString()} fund={fund} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerFundSection({ fund }: { fund: FundMetadata }) {
  const { fund: detail } = useFund(fund.fundId);
  const { metrics } = useSubVaultMetrics(fund.fundId);
  const chainGpt = useChainGptAnalysis();

  const [aaveBps, fixedBps] = fund.allocationBps;
  const blendedApyBps = (aaveBps * metrics.apys[0] + fixedBps * metrics.apys[1]) / 10_000;
  const blendedApyPct = (blendedApyBps / 100).toFixed(2);

  const fundAgeHours = Math.floor((Date.now() / 1000 - Number(fund.createdAt)) / 3600);
  const totalTvlUsdc = Number(formatUnits(detail?.totalDeployed ?? 0n, 6));

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
  }, [chainGpt, fund.name, aaveBps, fixedBps, metrics.apys, metrics.totalDeployed, totalTvlUsdc, fund.depositorCount, fundAgeHours]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Fund header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
        <div>
          <Eyebrow>Fund #{fund.fundId.toString()}</Eyebrow>
          <h2
            className="display"
            style={{ fontSize: 40, marginTop: 8, letterSpacing: "-0.02em", lineHeight: 1 }}
          >
            {fund.name}
            <span className="display-italic" style={{ color: "var(--pearl)" }}>
              .
            </span>
          </h2>
        </div>
        <Link href={`/fund/${fund.fundId}`}>
          <SfButton variant="ghost">View detail →</SfButton>
        </Link>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid var(--border)", background: "var(--surface)" }}>
        <StatCell
          label="Depositors"
          value={fund.depositorCount.toString()}
          sub="balances sealed"
          noBorderBottom
        />
        <StatCell
          label="Deployed"
          value={`$${Number(formatUnits(metrics.totalDeployed, 6)).toFixed(6)}`}
          sub="cUSDC"
          noBorderBottom
        />
        <StatCell
          label="Blended APY"
          value={Number(blendedApyPct) > 0 ? blendedApyPct + "%" : "—"}
          tone="green"
          noBorderBottom
        />
        <StatCell
          label="Perf fee"
          value={`${(Number(fund.performanceFeeBps) / 100).toFixed(2)}%`}
          noBorderBottom
          last
        />
      </div>

      {/* 2-col body */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <FundCapitalCard fund={fund} metrics={metrics} blendedApyPct={blendedApyPct} />
          <FundActionsCard fund={fund} metrics={metrics} />
        </div>
        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <FundInfoCard fund={fund} metrics={metrics} />
          <ChainGptAnalysisPanel
            analysis={chainGpt.analysis}
            isLoading={chainGpt.isLoading}
            error={chainGpt.error}
            onAnalyze={runAnalyze}
            vaultAddress={vaultAddress}
          />
        </div>
      </div>
    </div>
  );
}

function FundCapitalCard({
  fund,
  metrics,
  blendedApyPct,
}: {
  fund: FundMetadata;
  metrics: ReturnType<typeof useSubVaultMetrics>["metrics"];
  blendedApyPct: string;
}) {
  const { handleClient } = useHandleClient();

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
    if (!handleClient) { setTvlError("Handle client not ready"); return; }
    const handle = totalAssetsHandle as `0x${string}` | undefined;
    if (!handle || handle === ZERO_HANDLE) { setTvlDecrypted(0n); return; }
    setTvlDecrypting(true);
    setTvlError(null);
    try {
      const result = await handleClient.decrypt(handle);
      const raw = (result as { value?: unknown })?.value ?? result;
      setTvlDecrypted(typeof raw === "bigint" ? raw : BigInt(String(raw)));
    } catch (err) {
      setTvlError(err instanceof Error ? err.message : "Decryption failed");
    } finally {
      setTvlDecrypting(false);
    }
  }, [handleClient, totalAssetsHandle]);

  const [aaveBps, fixedBps] = fund.allocationBps;

  return (
    <SfCard style={{ padding: 28 }}>
      <Eyebrow>§ Capital</Eyebrow>
      <h3 className="display" style={{ fontSize: 24, marginTop: 6 }}>
        Capital overview
      </h3>

      {/* TVL decrypt */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--pearl)", marginBottom: 8 }}>
              ◉ Fund TVL (manager-only decrypt)
            </div>
            <div className="display" style={{ fontSize: 32 }}>
              <Scramble
                value={tvlDecrypted !== null ? (Number(formatUnits(tvlDecrypted, 6))).toFixed(6) : "0.000000"}
                length={12}
                resolved={!tvlDecrypting && tvlDecrypted !== null}
                prefix="$"
              />
            </div>
            {tvlError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6 }}>{tvlError}</div>}
          </div>
          <SfButton
            variant="secondary"
            size="sm"
            disabled={tvlDecrypting}
            onClick={decryptTvl}
          >
            {tvlDecrypting ? "Decrypting…" : "Decrypt TVL"}
          </SfButton>
        </div>
      </div>

      {/* Allocation bars */}
      <div style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Allocation · public</div>
        {[
          { label: "Aave USDC", bps: aaveBps, apy: metrics.apys[0] / 100, color: "var(--green)" },
          { label: "Fixed 8%", bps: fixedBps, apy: metrics.apys[1] / 100, color: "var(--pearl-dim)" },
        ].map((slot) => (
          <div key={slot.label} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: slot.color }}>{slot.label}</span>
              <span className="mono" style={{ color: "var(--text-muted)" }}>
                {slot.apy.toFixed(2)}% APY · {slot.bps / 100}%
              </span>
            </div>
            <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2 }}>
              <div
                style={{
                  height: "100%",
                  width: `${slot.bps / 100}%`,
                  background: slot.color,
                  borderRadius: 2,
                  transition: "width 600ms ease-out",
                }}
              />
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
              ${Number(formatUnits(metrics.values[aaveBps === slot.bps ? 0 : 1], 6)).toFixed(6)} deployed
            </div>
          </div>
        ))}
      </div>
    </SfCard>
  );
}

function FundActionsCard({
  fund,
  metrics,
}: {
  fund: FundMetadata;
  metrics: ReturnType<typeof useSubVaultMetrics>["metrics"];
}) {
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
    deployHook.step !== "idle" &&
    deployHook.step !== "error" &&
    deployHook.step !== "confirmed";
  const maxWithdraw = metrics.totalDeployed;

  return (
    <>
      {showAllocationModal && (
        <UpdateAllocationModal
          fundId={fund.fundId}
          currentBps={fund.allocationBps}
          onClose={() => setShowAllocationModal(false)}
        />
      )}
      <SfCard style={{ padding: 28 }}>
        <Eyebrow>§ Actions</Eyebrow>
        <h3 className="display" style={{ fontSize: 24, marginTop: 6, marginBottom: 20 }}>
          Manage capital
        </h3>

        {/* Update Allocation */}
        <div style={{ paddingBottom: 20, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Update Allocation</div>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Adjusts future deploys. Blocked while a deploy is pending.
          </p>
          <SfButton variant="secondary" size="sm" onClick={() => setShowAllocationModal(true)}>
            Open Allocation Editor
          </SfButton>
        </div>

        {/* Deploy Capital */}
        <div style={{ paddingBottom: 20, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Deploy Capital</div>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Bulk unwrap + fan-out to Aave USDC + Fixed pool per allocation.
          </p>
          {!hasPending ? (
            <div style={{ display: "flex", gap: 8 }}>
              <SfInput
                placeholder="USDC amount"
                mono
                value={deployAmt}
                onChange={(e) => setDeployAmt(e.target.value)}
                disabled={deployBusy}
                style={{ flex: 1 }}
              />
              <SfButton
                variant="primary"
                size="sm"
                disabled={!deployAmt || !fund.allocationSet || deployBusy}
                onClick={async () => {
                  const ok = await deployHook.deploy(fund.fundId, deployAmt);
                  if (ok) setDeployAmt("");
                }}
              >
                {deployHook.step === "initiating"
                  ? "Initiating…"
                  : deployHook.step === "cooldown"
                  ? "TEE Cooldown…"
                  : deployHook.step === "decrypting"
                  ? "Decrypting…"
                  : deployHook.step === "finalizing"
                  ? "Finalizing…"
                  : "Deploy →"}
              </SfButton>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 14,
                background: "oklch(0.78 0.14 155 / 0.08)",
                border: "1px solid var(--green)",
                borderRadius: 2,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--green)" }}>
                  Pending: {formatUnits(pendingAmt, 6)} USDC
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  TEE cooldown — retry finalize
                </div>
              </div>
              <SfButton
                variant="primary"
                size="sm"
                disabled={deployBusy}
                onClick={() => deployHook.retryFinalize(fund.fundId)}
              >
                {deployHook.step === "decrypting" ? "Decrypting…" : deployHook.step === "finalizing" ? "Finalizing…" : "Finalize"}
              </SfButton>
            </div>
          )}
          {deployHook.error && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--red)" }}>{deployHook.error}</div>
          )}
        </div>

        {/* Withdraw */}
        <div style={{ paddingBottom: 20, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Withdraw Capital</div>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Pulls USDC from sub-vaults. Max: {formatUnits(maxWithdraw, 6)} USDC
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <SfInput
              placeholder="USDC amount"
              mono
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
              disabled={withdrawHook.step === "writing"}
              style={{ flex: 1 }}
            />
            {maxWithdraw > 0n && (
              <SfButton
                variant="ghost"
                size="sm"
                disabled={withdrawHook.step === "writing"}
                onClick={() => setWithdrawAmt(formatUnits(maxWithdraw, 6))}
              >
                Max
              </SfButton>
            )}
            <SfButton
              variant="secondary"
              size="sm"
              disabled={!withdrawAmt || withdrawHook.step === "writing"}
              onClick={async () => {
                const ok = await withdrawHook.withdraw(fund.fundId, withdrawAmt);
                if (ok) setWithdrawAmt("");
              }}
            >
              {withdrawHook.step === "writing" ? "Withdrawing…" : "Withdraw"}
            </SfButton>
          </div>
          {withdrawHook.error && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--red)" }}>{withdrawHook.error}</div>
          )}
        </div>

        {/* Process Redeem */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Process Pending Redeem</div>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Only needed when capital is deployed. Withdraw first.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <SfInput
              placeholder="User address (0x...)"
              mono
              value={processAddr}
              onChange={(e) => setProcessAddr(e.target.value)}
              disabled={processRedeem.step === "writing"}
              style={{ flex: 1 }}
            />
            <SfButton
              variant="secondary"
              size="sm"
              disabled={!processAddr || processRedeem.step === "writing"}
              onClick={() => processRedeem.processRedeem(fund.fundId, processAddr as `0x${string}`)}
            >
              {processRedeem.step === "writing" ? "Processing…" : "Process"}
            </SfButton>
          </div>
          {processRedeem.error && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--red)" }}>{processRedeem.error}</div>
          )}
        </div>
      </SfCard>
    </>
  );
}

function FundInfoCard({
  fund,
  metrics,
}: {
  fund: FundMetadata;
  metrics: ReturnType<typeof useSubVaultMetrics>["metrics"];
}) {
  return (
    <SfCard style={{ padding: 28 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>§ Info</div>
      <KV label="Fund ID" value={<span className="mono">#{fund.fundId.toString()}</span>} />
      <KV label="Depositors" value={fund.depositorCount.toString()} />
      <KV
        label="Perf fee"
        value={<span className="mono">{(Number(fund.performanceFeeBps) / 100).toFixed(2)}%</span>}
      />
      <KV
        label="Deployed"
        value={<span className="mono">${Number(formatUnits(metrics.totalDeployed, 6)).toFixed(6)}</span>}
        last
      />
    </SfCard>
  );
}
