"use client";

import { useState } from "react";
import Link from "next/link";
import { SfTag } from "@/components/shadow-fund/primitives/sf-tag";
import { Ticker } from "@/components/shadow-fund/primitives/ticker";
import type { FundMetadata } from "@/hooks/use-fund-list";
import type { SubVaultMetrics } from "@/hooks/use-subvault-metrics";

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

function formatDeployed(n: bigint): string {
  const usdc = Number(n) / 1e6;
  if (usdc >= 1_000_000) return "$" + (usdc / 1_000_000).toFixed(2) + "M";
  if (usdc >= 1_000) return "$" + (usdc / 1_000).toFixed(1) + "K";
  return "$" + usdc.toFixed(2);
}

function weightedApy(metrics: SubVaultMetrics, alloc: [number, number]): number {
  const total = alloc[0] + alloc[1];
  if (total === 0) return 0;
  return (metrics.apys[0] * alloc[0] + metrics.apys[1] * alloc[1]) / total / 100;
}

function formatDate(ts: bigint): string {
  if (!ts || ts === 0n) return "—";
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

interface VaultListRowProps {
  fund: FundMetadata;
  metrics?: SubVaultMetrics;
}

export function VaultListRow({ fund, metrics }: VaultListRowProps) {
  const [hover, setHover] = useState(false);
  const risk = riskLevel(fund.allocationBps);
  const apy = metrics ? weightedApy(metrics, fund.allocationBps) : null;
  const deployed = metrics ? formatDeployed(metrics.totalDeployed) : "—";
  const strategy = `Aave ${fund.allocationBps[0] / 100}% · Fixed ${fund.allocationBps[1] / 100}%`;

  return (
    <Link href={`/fund/${fund.fundId}`} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1fr 1.3fr 0.8fr 1fr",
          alignItems: "center",
          padding: "22px 20px",
          background: hover ? "var(--surface-2)" : "var(--surface)",
          cursor: "pointer",
          position: "relative",
          transition: "background 150ms",
        }}
      >
        {hover && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 2,
              background: "var(--pearl)",
            }}
          />
        )}
        {/* Vault name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 2,
              flexShrink: 0,
              background: "linear-gradient(135deg, var(--pearl), var(--pearl-deep))",
            }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{fund.name}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              {`${fund.manager.slice(0, 6)}...${fund.manager.slice(-4)}`}
            </div>
          </div>
        </div>
        {/* Strategy */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SfTag tone={riskTone(risk)}>{risk}</SfTag>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-dim)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {strategy}
            </span>
          </div>
        </div>
        {/* APY */}
        <div className="mono tabular" style={{ fontSize: 16, color: "var(--green)" }}>
          {apy !== null && apy > 0 ? (
            <Ticker
              value={apy}
              format={(v) => v.toFixed(2) + "%"}
              interval={1000}
              jitter={0.0003}
            />
          ) : (
            "—"
          )}
        </div>
        {/* Deployed */}
        <div style={{ fontSize: 13 }}>
          <span className="mono tabular">{deployed}</span>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            aUSDC · Aave v3
          </div>
        </div>
        {/* Users */}
        <div className="mono tabular" style={{ fontSize: 13 }}>
          {Number(fund.depositorCount)}
        </div>
        {/* Inception */}
        <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {formatDate(fund.createdAt)}
        </div>
      </div>
    </Link>
  );
}
