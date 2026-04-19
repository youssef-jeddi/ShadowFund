"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { formatUnits } from "viem";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";
import { SfCard } from "@/components/shadow-fund/primitives/sf-card";
import { SfTag } from "@/components/shadow-fund/primitives/sf-tag";
import { SfInput } from "@/components/shadow-fund/primitives/sf-input";
import { StatCell } from "@/components/shadow-fund/primitives/stat-cell";
import { KV } from "@/components/shadow-fund/primitives/kv";
import { Scramble } from "@/components/shadow-fund/primitives/scramble";
import { Ticker } from "@/components/shadow-fund/primitives/ticker";
import { AddressChip } from "@/components/shadow-fund/primitives/address-chip";
import { useFund } from "@/hooks/use-fund";
import { useMyPosition } from "@/hooks/use-my-position";
import { useRequestDeposit } from "@/hooks/use-request-deposit";
import { useRequestRedeem } from "@/hooks/use-request-redeem";
import { useClaimRedemption } from "@/hooks/use-claim-redemption";
import { useSubVaultMetrics } from "@/hooks/use-subvault-metrics";

interface FundDetailContentProps {
  fundId: bigint;
}

function riskLevel(allocationBps: [number, number]): "Low" | "Medium" | "High" {
  const aave = allocationBps[0];
  if (aave >= 8000) return "High";
  if (aave >= 4000) return "Medium";
  return "Low";
}

function riskTone(risk: string): "green" | "accent" | "red" {
  if (risk === "Low") return "green";
  if (risk === "High") return "red";
  return "accent";
}

function formatDate(ts: bigint): string {
  if (!ts || ts === 0n) return "—";
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
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
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 32 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading vault…</div>
      </div>
    );
  }

  if (!fund) {
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "80px 32px", textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)", marginBottom: 24 }}>Vault not found.</div>
        <Link href="/funds">
          <SfButton variant="secondary">← All Vaults</SfButton>
        </Link>
      </div>
    );
  }

  const [aaveBps, fixedBps] = fund.allocationBps;
  const blendedApyBps = (aaveBps * metrics.apys[0] + fixedBps * metrics.apys[1]) / 10_000;
  const blendedApyPct = (blendedApyBps / 100);
  const hasAllocation = fund.allocationSet;
  const risk = riskLevel(fund.allocationBps);
  const strategyTag = `Aave ${aaveBps / 100}% · Fixed ${fixedBps / 100}%`;

  const balanceResolved = !decrypting && position.decryptedBalance !== null;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 32px" }}>
      {/* Back */}
      <Link href="/funds">
        <button
          className="eyebrow"
          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          ← All Vaults
        </button>
      </Link>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          marginTop: 24,
          paddingBottom: 36,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 3,
              background: "linear-gradient(135deg, var(--pearl), var(--pearl-deep))",
              flexShrink: 0,
            }}
          />
          <div>
            <Eyebrow>
              {formatDate(fund.createdAt) !== "—"
                ? `Inception ${formatDate(fund.createdAt)}`
                : "Vault"}
            </Eyebrow>
            <h1
              className="display"
              style={{ fontSize: 64, letterSpacing: "-0.028em", lineHeight: 1, marginTop: 10 }}
            >
              {fund.name}
              <span className="display-italic" style={{ color: "var(--pearl)" }}>
                .
              </span>
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
              <AddressChip addr={`${fund.manager.slice(0, 6)}...${fund.manager.slice(-4)}`} size="lg" />
              <span style={{ color: "var(--text-muted)" }}>·</span>
              <SfTag tone={riskTone(risk)}>
                {risk} Risk · {strategyTag}
              </SfTag>
            </div>
            {fund.description && (
              <p style={{ marginTop: 14, color: "var(--text-dim)", fontSize: 14, maxWidth: 560 }}>
                {fund.description}
              </p>
            )}
          </div>
        </div>
        {address && !isManager && (
          <SfButton variant="primary" size="lg" onClick={() => setActiveTab("deposit")}>
            Deposit cUSDC
          </SfButton>
        )}
      </div>

      {/* 5-stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)" }}>
        <StatCell
          label="APY (30d)"
          value={
            hasAllocation && blendedApyPct > 0 ? (
              <Ticker
                value={blendedApyPct}
                format={(v) => v.toFixed(2) + "%"}
                interval={700}
                jitter={0.0004}
              />
            ) : (
              "—"
            )
          }
          tone="green"
        />
        <StatCell
          label="TVL"
          value={`$${(Number(formatUnits(metrics.totalDeployed, 6))).toFixed(2)}`}
          sub="cUSDC · public total"
        />
        <StatCell
          label="Depositors"
          value={Number(fund.depositorCount).toString()}
          sub="balances sealed"
        />
        <StatCell
          label="Perf Fee"
          value={`${(Number(fund.performanceFeeBps) / 100).toFixed(2)}%`}
          sub="on yield"
        />
        <StatCell
          label="Your Balance"
          value={
            address ? (
              <Scramble
                value={position.decryptedBalance?.toString() ?? "0"}
                length={6}
                resolved={balanceResolved}
              />
            ) : (
              "—"
            )
          }
          sub="visible to you only"
          last
        />
      </div>

      {/* Body — 2 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 32, marginTop: 48 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Strategy */}
          <SfCard style={{ padding: 28 }}>
            <Eyebrow>§ Strategy · Public</Eyebrow>
            <h3
              className="display"
              style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 6 }}
            >
              How this vault deploys capital
            </h3>
            {hasAllocation ? (
              <>
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Aave USDC", pct: aaveBps / 100, apy: metrics.apys[0] / 100, color: "var(--green)" },
                    { label: "Fixed 8%", pct: fixedBps / 100, apy: metrics.apys[1] / 100, color: "var(--pearl-dim)" },
                  ].map((slot) => (
                    <div key={slot.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 80, fontSize: 12, color: slot.color }}>{slot.label}</span>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          background: "var(--surface-2)",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${slot.pct}%`,
                            background: slot.color,
                            transition: "width 600ms ease-out",
                          }}
                        />
                      </div>
                      <span className="mono" style={{ width: 40, textAlign: "right", fontSize: 12 }}>
                        {slot.pct.toFixed(0)}%
                      </span>
                      <span className="mono" style={{ width: 60, textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>
                        {slot.apy.toFixed(2)}% APY
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="eyebrow" style={{ color: "var(--pearl)", marginBottom: 10 }}>
                    ◉ What&apos;s private
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
                    Individual deposit amounts and per-user balances are encrypted by iExec Nox.
                    The manager and all observers see only aggregate TVL — never who deposited what.
                  </p>
                </div>
              </>
            ) : (
              <p style={{ color: "var(--text-muted)", marginTop: 14, fontSize: 14 }}>
                Allocation not set yet.
              </p>
            )}
          </SfCard>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Position + actions */}
          {address && (
            <SfCard style={{ padding: 28 }}>
              <div className="eyebrow" style={{ color: "var(--pearl)" }}>
                ◉ Position
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="eyebrow">Your balance</div>
                <div className="display" style={{ fontSize: 40, marginTop: 6 }}>
                  <Scramble
                    value={position.decryptedBalance?.toString() ?? "0"}
                    length={6}
                    resolved={balanceResolved}
                  />
                </div>
                {!balanceResolved && (
                  <button
                    onClick={decryptBalance}
                    disabled={decrypting}
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "var(--pearl)",
                      background: "none",
                      border: "none",
                      cursor: decrypting ? "default" : "pointer",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {decrypting ? "Decrypting…" : "Decrypt with signature →"}
                  </button>
                )}
                {decryptError && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--red)" }}>{decryptError}</div>
                )}
              </div>

              {!isManager && (
                <>
                  {/* Tab bar */}
                  <div
                    style={{
                      display: "flex",
                      gap: 0,
                      marginTop: 24,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {(
                      ["deposit", "redeem", ...(position.isClaimable ? ["claim"] : [])] as const
                    ).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as typeof activeTab)}
                        style={{
                          padding: "8px 14px",
                          fontSize: 11,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase" as const,
                          color: activeTab === tab ? "var(--text)" : "var(--text-muted)",
                          background: "none",
                          border: "none",
                          borderBottom: "2px solid " + (activeTab === tab ? "var(--pearl)" : "transparent"),
                          cursor: "pointer",
                          transition: "color 150ms",
                        }}
                      >
                        {tab === "claim" ? "Claim ✓" : tab}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 20 }}>
                    {activeTab === "deposit" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                          Your deposit amount is encrypted end-to-end. Need cUSDC?{" "}
                          <Link href="/dashboard" style={{ color: "var(--pearl)" }}>
                            Wrap USDC →
                          </Link>
                        </p>
                        <SfInput
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Amount (cUSDC)"
                          mono
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                        <SfButton
                          variant="primary"
                          style={{ width: "100%" }}
                          disabled={!depositAmount || depositHook.step !== "idle"}
                          onClick={async () => {
                            const ok = await depositHook.requestDeposit(fundId, depositAmount);
                            if (ok) setDepositAmount("");
                          }}
                        >
                          {depositHook.step === "idle" || depositHook.step === "error" || depositHook.step === "confirmed"
                            ? "Encrypt & Deposit"
                            : depositHook.step === "encrypting"
                            ? "Encrypting…"
                            : "Submitting…"}
                        </SfButton>
                        {depositHook.error && (
                          <div style={{ fontSize: 12, color: "var(--red)" }}>{depositHook.error}</div>
                        )}
                        {depositHook.step === "confirmed" && (
                          <div style={{ fontSize: 12, color: "var(--green)" }}>
                            Deposited — shares minted and credited.
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "redeem" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Decrypt your balance first to know your shares.
                        </p>
                        <SfInput
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Shares to redeem"
                          mono
                          value={redeemAmount}
                          onChange={(e) => setRedeemAmount(e.target.value)}
                        />
                        <SfButton
                          variant="secondary"
                          style={{ width: "100%" }}
                          disabled={!redeemAmount || redeemHook.step !== "idle"}
                          onClick={async () => {
                            const ok = await redeemHook.requestRedeem(fundId, redeemAmount);
                            if (ok) setRedeemAmount("");
                          }}
                        >
                          {redeemHook.step === "idle" || redeemHook.step === "error" || redeemHook.step === "confirmed"
                            ? "Request Redeem"
                            : redeemHook.step === "encrypting"
                            ? "Encrypting…"
                            : "Submitting…"}
                        </SfButton>
                        {redeemHook.error && (
                          <div style={{ fontSize: 12, color: "var(--red)" }}>{redeemHook.error}</div>
                        )}
                        {redeemHook.step === "confirmed" && (
                          <div style={{ fontSize: 12, color: "var(--green)" }}>
                            Redeem submitted — manager will process it.
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "claim" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Redemption processed. Click to receive your cUSDC.
                        </p>
                        <SfButton
                          variant="primary"
                          style={{ width: "100%" }}
                          disabled={claimHook.step !== "idle"}
                          onClick={() => claimHook.claimRedemption(fundId)}
                        >
                          {claimHook.step === "idle" || claimHook.step === "error" || claimHook.step === "confirmed"
                            ? "Claim cUSDC"
                            : "Claiming…"}
                        </SfButton>
                        {claimHook.error && (
                          <div style={{ fontSize: 12, color: "var(--red)" }}>{claimHook.error}</div>
                        )}
                        {claimHook.step === "confirmed" && (
                          <div style={{ fontSize: 12, color: "var(--green)" }}>
                            cUSDC claimed successfully.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {isManager && (
                <div style={{ marginTop: 20 }}>
                  <Link href="/dashboard/manager">
                    <SfButton variant="secondary" style={{ width: "100%" }}>
                      Manage Fund →
                    </SfButton>
                  </Link>
                </div>
              )}
            </SfCard>
          )}

          {/* Terms */}
          <SfCard style={{ padding: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>§ Terms</div>
            <KV
              label="Min deposit"
              value={<span className="mono">1 cUSDC</span>}
            />
            <KV label="Lockup" value={<span className="mono">None</span>} />
            <KV
              label="Perf fee"
              value={
                <span className="mono">
                  {(Number(fund.performanceFeeBps) / 100).toFixed(2)}%
                </span>
              }
            />
            <KV
              label="Protocol fee"
              value={<span className="mono">0.10%</span>}
              last
            />
          </SfCard>
        </div>
      </div>
    </div>
  );
}
