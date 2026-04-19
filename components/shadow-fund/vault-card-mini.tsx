"use client";

import Link from "next/link";
import { SfCard } from "@/components/shadow-fund/primitives/sf-card";
import { SfTag } from "@/components/shadow-fund/primitives/sf-tag";
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

function formatTvl(n: bigint): string {
  const usdc = Number(n) / 1e6;
  if (usdc >= 1_000_000) return "$" + (usdc / 1_000_000).toFixed(2) + "M";
  if (usdc >= 1_000) return "$" + (usdc / 1_000).toFixed(1) + "K";
  return "$" + usdc.toFixed(0);
}

function weightedApy(metrics: SubVaultMetrics, alloc: [number, number]): number {
  const total = alloc[0] + alloc[1];
  if (total === 0) return 0;
  return (metrics.apys[0] * alloc[0] + metrics.apys[1] * alloc[1]) / total / 100;
}

interface VaultCardMiniProps {
  fund: FundMetadata;
  metrics?: SubVaultMetrics;
}

export function VaultCardMini({ fund, metrics }: VaultCardMiniProps) {
  const risk = riskLevel(fund.allocationBps);
  const apy = metrics ? weightedApy(metrics, fund.allocationBps) : 0;
  const tvl = metrics ? formatTvl(metrics.totalDeployed) : "—";

  return (
    <Link href={`/fund/${fund.fundId}`} style={{ textDecoration: "none" }}>
      <SfCard interactive style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 2,
                background: "linear-gradient(135deg, var(--pearl), var(--pearl-deep))",
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{fund.name}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                {`${fund.manager.slice(0, 6)}...${fund.manager.slice(-4)}`}
              </div>
            </div>
          </div>
          <SfTag tone={riskTone(risk)}>{risk} Risk</SfTag>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div>
            <div className="eyebrow">APY</div>
            <div className="mono" style={{ fontSize: 18, color: "var(--green)", marginTop: 4 }}>
              {apy > 0 ? apy.toFixed(2) + "%" : "—"}
            </div>
          </div>
          <div>
            <div className="eyebrow">TVL</div>
            <div className="mono" style={{ fontSize: 14, marginTop: 6 }}>{tvl}</div>
          </div>
          <div>
            <div className="eyebrow">Users</div>
            <div className="mono" style={{ fontSize: 14, marginTop: 6 }}>
              {Number(fund.depositorCount)}
            </div>
          </div>
        </div>
      </SfCard>
    </Link>
  );
}
