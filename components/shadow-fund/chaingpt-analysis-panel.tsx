"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <Card
      className="rounded-2xl border"
      style={{
        background: "var(--sf-reveal-bg)",
        borderColor: "var(--sf-violet-border)",
      }}
    >
      <CardHeader className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="text-base font-semibold text-text-heading">
            ChainGPT Strategy Analysis
          </h3>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          AI-powered breakdown of the revealed allocation and its performance.
        </p>
      </CardHeader>

      <CardContent className="px-5 py-4">
        {!analysis && !isLoading && !error && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-sm text-text-body">
              Strategy has been revealed. Run AI analysis to get insights.
            </p>
            <Button
              onClick={onAnalyze}
              className="px-6"
              style={{ background: "var(--sf-violet)", color: "#fff" }}
            >
              Analyze Strategy
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--sf-violet)" }}
            />
            <p className="text-sm text-text-muted">Analyzing strategy...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
            <button
              onClick={onAnalyze}
              className="ml-2 underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {analysis && (
          <div className="flex flex-col gap-4">
            <Section title="Summary" content={analysis.summary} />
            <Section title="Asset Breakdown" content={analysis.assetBreakdown} />
            <Section title="Performance Insights" content={analysis.performanceInsights} />
            <Section title="Risk Assessment" content={analysis.riskAssessment} />

            {/* Audit button */}
            {vaultAddress && onAudit && (
              <div
                className="mt-2 flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  background: "var(--sf-violet-subtle)",
                  border: "1px solid var(--sf-violet-border)",
                }}
              >
                <div>
                  <p className="text-sm font-medium text-text-heading">Smart Contract Audit</p>
                  <p className="text-xs text-text-muted">
                    One-click audit via ChainGPT
                  </p>
                </div>
                <Button
                  onClick={onAudit}
                  size="sm"
                  variant="outline"
                  style={{ borderColor: "var(--sf-violet-border)", color: "var(--sf-violet-text)" }}
                >
                  Audit Contract
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--sf-violet-text)" }}>
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-text-body whitespace-pre-wrap">{content}</p>
    </div>
  );
}
