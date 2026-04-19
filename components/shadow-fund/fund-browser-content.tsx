"use client";

import { useState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";
import { VaultListRow } from "@/components/shadow-fund/vault-list-row";
import { useFundList, type FundMetadata } from "@/hooks/use-fund-list";
import { useSubVaultMetrics } from "@/hooks/use-subvault-metrics";

type SortKey = "tvl" | "apy" | "users";
type FilterKey = "all" | "low" | "medium" | "high";

function riskLevel(allocationBps: [number, number]): string {
  const aave = allocationBps[0];
  if (aave >= 8000) return "high";
  if (aave >= 4000) return "medium";
  return "low";
}

function AggCell({
  label,
  value,
  suffix,
  last = false,
}: {
  label: string;
  value: React.ReactNode;
  suffix: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "24px 28px",
        borderRight: last ? "none" : "1px solid var(--border)",
      }}
    >
      <div className="eyebrow">{label}</div>
      <div
        className="display"
        style={{
          fontSize: 26,
          marginTop: 10,
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 6,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {suffix}
      </div>
    </div>
  );
}

function FundRowWithMetrics({
  fund,
}: {
  fund: FundMetadata;
}) {
  const { metrics } = useSubVaultMetrics(fund.fundId);
  return <VaultListRow fund={fund} metrics={metrics} />;
}

export function FundBrowserContent() {
  const { funds, isLoading, count } = useFundList();
  const [sort, setSort] = useState<SortKey>("tvl");
  const [filter, setFilter] = useState<FilterKey>("all");

  const totalDepositors = funds.reduce((s, f) => s + Number(f.depositorCount), 0);

  const filtered = funds.filter((f) =>
    filter === "all" ? true : riskLevel(f.allocationBps) === filter
  );

  // We can only sort by users without additional hook data at this level
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "users") return Number(b.depositorCount) - Number(a.depositorCount);
    // tvl/apy: sort by depositor count as a proxy when metrics unavailable at this level
    return Number(b.depositorCount) - Number(a.depositorCount);
  });

  const filterBtns: { id: FilterKey; l: string }[] = [
    { id: "all", l: "All" },
    { id: "low", l: "Low Risk" },
    { id: "medium", l: "Medium" },
    { id: "high", l: "High" },
  ];

  const sortBtns: { id: SortKey; l: string }[] = [
    { id: "tvl", l: "TVL" },
    { id: "apy", l: "APY" },
    { id: "users", l: "Users" },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "56px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
        <div>
          <Eyebrow>ShadowFund · Vault Registry</Eyebrow>
          <h1
            className="display"
            style={{ fontSize: 72, marginTop: 16, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            All Vaults
            <span className="display-italic" style={{ color: "var(--pearl)" }}>
              .
            </span>
          </h1>
          <p style={{ color: "var(--text-dim)", marginTop: 14, fontSize: 15 }}>
            {isLoading ? "Loading vaults…" : `${count} active vault${count !== 1 ? "s" : ""}`} ·
            Strategies are public. Individual deposit amounts remain private to each user.
          </p>
        </div>
        <Link href="/dashboard/manager">
          <SfButton variant="primary">+ Launch Vault</SfButton>
        </Link>
      </div>

      {/* Aggregate strip */}
      <div
        style={{
          marginTop: 40,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <AggCell
          label="Active Vaults"
          value={count > 0 ? count.toLocaleString() : "—"}
          suffix="on-chain"
        />
        <AggCell
          label="Depositors"
          value={totalDepositors > 0 ? totalDepositors.toLocaleString() : "—"}
          suffix="balances sealed"
          last
        />
      </div>

      {/* Filter + sort bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 40,
          paddingBottom: 20,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {filterBtns.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                border: "1px solid " + (filter === f.id ? "var(--pearl)" : "var(--border)"),
                color: filter === f.id ? "var(--pearl)" : "var(--text-dim)",
                background: filter === f.id ? "oklch(0.92 0.02 90 / 0.05)" : "transparent",
                borderRadius: 2,
                cursor: "pointer",
                transition: "all 150ms",
              }}
            >
              {f.l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="eyebrow">Sort by</span>
          {sortBtns.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              style={{
                padding: "6px 10px",
                fontSize: 11,
                color: sort === s.id ? "var(--pearl)" : "var(--text-muted)",
                borderBottom: "1px solid " + (sort === s.id ? "var(--pearl)" : "transparent"),
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                cursor: "pointer",
                background: "transparent",
                transition: "color 150ms",
              }}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          Loading vaults…
        </div>
      ) : count === 0 ? (
        <div
          style={{
            padding: "64px 32px",
            textAlign: "center",
            border: "1px dashed var(--border)",
            marginTop: 32,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 16 }}>◉</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>No vaults yet</div>
          <div style={{ color: "var(--text-muted)", marginTop: 8, marginBottom: 24 }}>
            Be the first to create a confidential fund.
          </div>
          <Link href="/dashboard/manager">
            <SfButton variant="primary">Create a Fund</SfButton>
          </Link>
        </div>
      ) : (
        <div
          style={{
            marginTop: 32,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            background: "var(--border)",
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 1fr 1.3fr 0.8fr 1fr",
              background: "var(--bg-2)",
              padding: "14px 20px",
            }}
          >
            {["Vault", "Strategy", "APY", "TVL", "Users", "Inception"].map((c) => (
              <div key={c} className="eyebrow">
                {c}
              </div>
            ))}
          </div>
          {sorted.map((fund) => (
            <FundRowWithMetrics key={fund.fundId.toString()} fund={fund} />
          ))}
        </div>
      )}
    </div>
  );
}
