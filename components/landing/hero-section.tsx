"use client";

import Link from "next/link";
import { Scramble } from "@/components/shadow-fund/primitives/scramble";
import { Ticker } from "@/components/shadow-fund/primitives/ticker";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";
import { SfTag } from "@/components/shadow-fund/primitives/sf-tag";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import { useFundList } from "@/hooks/use-fund-list";

function FloatingConfidentialCard() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 400,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: 24,
        borderRadius: 3,
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.5)",
        animation: "fade-up 600ms ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 2,
              background: "linear-gradient(135deg, var(--pearl), var(--pearl-deep))",
            }}
          />
          <div>
            <div style={{ fontSize: 13 }}>Crescent Yield</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
              cYLD · nightshade dao
            </div>
          </div>
        </div>
        <SfTag tone="encrypted">Private Balance</SfTag>
      </div>
      <div
        style={{
          padding: "20px 0",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Your Balance
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <Scramble
            value="1284.44"
            length={9}
            resolved={false}
            style={{ fontSize: 32 }}
          />
          <span className="mono" style={{ fontSize: 13, color: "var(--text-muted)" }}>
            cUSDC
          </span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
          visible only to your wallet
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div>
          <div className="eyebrow">APY</div>
          <div className="mono" style={{ color: "var(--green)", fontSize: 18, marginTop: 4 }}>
            <Ticker value={9.81} format={(v) => v.toFixed(2) + "%"} interval={600} jitter={0.0006} />
          </div>
        </div>
        <div>
          <div className="eyebrow">Strategy</div>
          <div className="mono" style={{ fontSize: 11, marginTop: 6, color: "var(--text-dim)" }}>
            Aave v3 · Looped
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div
      style={{
        padding: "24px 20px 24px 0",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="eyebrow">{label}</div>
      <div
        className="display"
        style={{
          fontSize: 26,
          marginTop: 12,
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
        {sub}
      </div>
    </div>
  );
}

export function HeroSection() {
  const { funds, count, isLoading } = useFundList();

  const totalDepositors = funds.reduce(
    (sum, f) => sum + Number(f.depositorCount),
    0
  );

  return (
    <section
      style={{
        position: "relative",
        padding: "80px 32px 60px",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 48,
          alignItems: "start",
        }}
      >
        <div>
          <Eyebrow dot>Private DeFi · Powered by iExec Nox</Eyebrow>
          <h1
            className="display"
            style={{
              fontSize: "clamp(56px, 9vw, 112px)",
              lineHeight: 0.95,
              marginTop: 32,
              letterSpacing: "-0.035em",
              fontWeight: 500,
            }}
          >
            Yield without
            <br />
            <span className="display-italic" style={{ color: "var(--pearl)" }}>
              disclosure
            </span>
            .
          </h1>
          <p
            style={{
              marginTop: 36,
              maxWidth: 580,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--text-dim)",
            }}
          >
            ShadowFund is a confidential vault protocol. Managers publish their
            strategies openly. Depositors allocate with{" "}
            <em style={{ color: "var(--text)", fontStyle: "normal" }}>cUSDC</em>{" "}
            — and every individual balance stays encrypted on-chain. Transparent
            where it matters. Private where it counts.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 44 }}>
            <Link href="/funds">
              <SfButton variant="primary" size="lg">
                Browse Vaults →
              </SfButton>
            </Link>
            <Link href="/dashboard/manager">
              <SfButton variant="secondary" size="lg">
                Launch a Vault
              </SfButton>
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              marginTop: 80,
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <HeroMetric
              label="Vaults"
              value={isLoading ? "—" : String(count)}
              sub="active"
            />
            <HeroMetric
              label="Depositors"
              value={isLoading ? "—" : totalDepositors > 0 ? totalDepositors.toLocaleString() : "—"}
              sub="balances sealed"
            />
          </div>
        </div>
        <div style={{ paddingTop: 40 }}>
          <FloatingConfidentialCard />
        </div>
      </div>
    </section>
  );
}
