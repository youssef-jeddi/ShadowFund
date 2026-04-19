"use client";

import Link from "next/link";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";
import { VaultCardMini } from "@/components/shadow-fund/vault-card-mini";
import { useFundList } from "@/hooks/use-fund-list";
import { useSubVaultMetrics } from "@/hooks/use-subvault-metrics";

const STEPS = [
  {
    n: "01",
    t: "Manager publishes strategy",
    b: "Every vault ships with its allocation, target protocols, risk profile, and fees fully disclosed on-chain. Depositors know exactly what they're underwriting.",
  },
  {
    n: "02",
    t: "Depositors allocate cUSDC privately",
    b: "Users deposit confidential USDC. Individual deposit amounts and balances are sealed by iExec Nox — the manager sees only the aggregate, never who put in what.",
  },
  {
    n: "03",
    t: "Manager deploys to Aave",
    b: "The vault executes as a single on-chain actor on Aave v3. Yield flows back to the vault, then back to depositors — proportionally, without revealing individual positions.",
  },
];

function FeaturedFunds() {
  const { funds, isLoading } = useFundList();

  const top3 = funds.slice(0, 3);

  if (isLoading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 220,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              animation: "fade-up 400ms ease-out",
            }}
          />
        ))}
      </div>
    );
  }

  if (top3.length === 0) {
    return (
      <div
        style={{
          border: "1px solid var(--border)",
          padding: "48px 32px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        No vaults deployed yet.{" "}
        <Link href="/dashboard/manager" style={{ color: "var(--pearl)" }}>
          Launch the first one →
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
    >
      {top3.map((fund) => (
        <FundCardWithMetrics key={fund.fundId.toString()} fund={fund} />
      ))}
    </div>
  );
}

function FundCardWithMetrics({ fund }: { fund: ReturnType<typeof useFundList>["funds"][0] }) {
  const { metrics } = useSubVaultMetrics(fund.fundId);
  return <VaultCardMini fund={fund} metrics={metrics} />;
}

export function FeaturesSection() {
  return (
    <div>
      {/* § 01 Mechanism */}
      <section
        style={{
          maxWidth: 1400,
          margin: "120px auto 0",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: 80,
          }}
        >
          <div>
            <Eyebrow>§ 01 Mechanism</Eyebrow>
            <h2
              className="display"
              style={{
                fontSize: 56,
                lineHeight: 1.02,
                marginTop: 24,
                letterSpacing: "-0.025em",
              }}
            >
              Open strategy.
              <br />
              <span className="display-italic" style={{ color: "var(--pearl)" }}>
                Sealed balances.
              </span>
            </h2>
          </div>
          <div>
            {STEPS.map((step) => (
              <div
                key={step.n}
                style={{
                  padding: "32px 0",
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  gap: 24,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--pearl)",
                    letterSpacing: "0.14em",
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <h3
                    className="display"
                    style={{
                      fontSize: 26,
                      letterSpacing: "-0.015em",
                      fontWeight: 500,
                    }}
                  >
                    {step.t}
                  </h3>
                  <p
                    style={{
                      marginTop: 10,
                      color: "var(--text-dim)",
                      maxWidth: 520,
                      lineHeight: 1.6,
                      fontSize: 14,
                    }}
                  >
                    {step.b}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* § 02 Featured Vaults */}
      <section
        style={{
          maxWidth: 1400,
          margin: "120px auto 0",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            marginBottom: 40,
          }}
        >
          <div>
            <Eyebrow>§ 02 Active Vaults</Eyebrow>
            <h2
              className="display"
              style={{
                fontSize: 48,
                marginTop: 16,
                letterSpacing: "-0.025em",
              }}
            >
              Featured vaults
            </h2>
          </div>
          <Link href="/funds">
            <SfButton variant="ghost">All vaults →</SfButton>
          </Link>
        </div>
        <FeaturedFunds />
      </section>

      {/* CTA Strip */}
      <section
        style={{
          maxWidth: 1400,
          margin: "120px auto 0",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            border: "1px solid var(--pearl-dim)",
            padding: "80px 64px",
            background:
              "linear-gradient(135deg, oklch(0.92 0.02 90 / 0.05), transparent 70%)",
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: 48,
            alignItems: "center",
            borderRadius: 2,
          }}
        >
          <div>
            <Eyebrow dot>Manager Program</Eyebrow>
            <h2
              className="display"
              style={{
                fontSize: 56,
                marginTop: 20,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              Run capital
              <br />
              <span className="display-italic" style={{ color: "var(--pearl)" }}>
                in the dark
              </span>
              .
            </h2>
            <p
              style={{
                color: "var(--text-dim)",
                marginTop: 20,
                maxWidth: 500,
                lineHeight: 1.6,
              }}
            >
              Spin up a vault in four steps. Publish your strategy, set your
              fees and lockups, attract private capital. ShadowFund takes a 0.1%
              protocol fee on yield — nothing else.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/dashboard/manager">
              <SfButton variant="primary" size="lg">
                Launch a Vault
              </SfButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
