"use client";

import { SfCard } from "@/components/shadow-fund/primitives/sf-card";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import type { StrategyAnalysis } from "@/hooks/use-chaingpt-analysis";

interface ChainGptAnalysisPanelProps {
  analysis: StrategyAnalysis | null;
  isLoading: boolean;
  error: string | null;
  onAnalyze: () => void;
  onAudit?: () => void;
  vaultAddress?: string;
}

export function ChainGptAnalysisPanel({
  analysis,
  isLoading,
  error,
  onAnalyze,
  onAudit,
  vaultAddress,
}: ChainGptAnalysisPanelProps) {
  return (
    <SfCard style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Eyebrow>§ ChainGPT · AI Analysis</Eyebrow>
      </div>
      <h3
        className="display"
        style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 6 }}
      >
        Strategy breakdown
      </h3>
      <p
        style={{
          marginTop: 10,
          fontSize: 13,
          color: "var(--text-dim)",
          lineHeight: 1.6,
          maxWidth: 640,
        }}
      >
        Public allocation, per-vault yield, and risk profile — synthesized by
        ChainGPT. No private balances are read.
      </p>

      {!analysis && !isLoading && !error && (
        <div style={{ marginTop: 24 }}>
          <SfButton variant="primary" onClick={onAnalyze}>
            Analyze Strategy
          </SfButton>
        </div>
      )}

      {isLoading && (
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              border: "1.5px solid var(--border-strong)",
              borderTopColor: "var(--pearl)",
              animation: "spin 900ms linear infinite",
            }}
          />
          Analyzing strategy…
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 20,
            padding: "12px 14px",
            border: "1px solid var(--red)",
            background: "oklch(0.68 0.18 25 / 0.08)",
            fontSize: 12,
            color: "var(--red)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={onAnalyze}
            style={{
              background: "none",
              border: "none",
              color: "var(--red)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {analysis && (
        <div
          style={{
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <Section title="Summary" content={analysis.summary} />
          <Section title="Asset Breakdown" content={analysis.assetBreakdown} />
          <Section
            title="Performance Insights"
            content={analysis.performanceInsights}
          />
          <Section title="Risk Assessment" content={analysis.riskAssessment} />

          {vaultAddress && onAudit && (
            <div
              style={{
                marginTop: 4,
                padding: 16,
                border: "1px solid var(--border)",
                background: "var(--bg-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  Smart Contract Audit
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginTop: 4,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  One-click audit via ChainGPT
                </div>
              </div>
              <SfButton variant="secondary" onClick={onAudit}>
                Audit Contract
              </SfButton>
            </div>
          )}
        </div>
      )}
    </SfCard>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        className="eyebrow"
        style={{ color: "var(--pearl)", letterSpacing: "0.16em" }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-dim)",
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
        }}
      >
        {content}
      </p>
    </div>
  );
}
