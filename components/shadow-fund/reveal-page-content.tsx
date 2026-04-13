"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChainGptAnalysisPanel } from "@/components/shadow-fund/chaingpt-analysis-panel";
import { useFund } from "@/hooks/use-fund";
import { useRevealStrategy } from "@/hooks/use-reveal-strategy";
import { useChainGptAnalysis } from "@/hooks/use-chaingpt-analysis";
import { CONTRACTS } from "@/lib/contracts";
import Link from "next/link";

const ASSET_LABELS = ["ETH", "BTC", "LINK", "USDC"];
const ASSET_COLORS = ["#6366f1", "#f59e0b", "#3b82f6", "#10b981"];

interface RevealPageContentProps {
  fundId: bigint;
}

export function RevealPageContent({ fundId }: RevealPageContentProps) {
  const { address } = useAccount();
  const { fund, isLoading, refetch } = useFund(fundId);
  const revealHook = useRevealStrategy();
  const analysisHook = useChainGptAnalysis();

  // Triple-confirm state
  const [understood, setUnderstood] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  // Plaintext strategy inputs (manager knows these, they encrypted them)
  const [eth, setEth] = useState(25);
  const [btc, setBtc] = useState(25);
  const [link, setLink] = useState(25);
  const [usdc, setUsdc] = useState(25);

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const isManager = address?.toLowerCase() === fund?.manager.toLowerCase();

  const handleReveal = useCallback(async () => {
    if (!fund) return;
    const ok = await revealHook.revealStrategy(fundId, { eth, btc, link, usdc });
    if (ok) await refetch();
  }, [revealHook, fundId, eth, btc, link, usdc, fund, refetch]);

  const handleAnalyze = useCallback(() => {
    if (!fund?.revealedStrategy || fund.startPrices === null) return;
    const [startEth, startBtc, startLink, startUsdc] = fund.startPrices;
    analysisHook.analyze({
      fundName: fund.name,
      strategy: fund.revealedStrategy,
      startPrices: {
        eth:  Number(startEth)  / 1e8,
        btc:  Number(startBtc)  / 1e8,
        link: Number(startLink) / 1e8,
        usdc: Number(startUsdc) / 1e8,
      },
      currentPrices: {
        eth:  Number(startEth)  / 1e8, // front-end fetches live prices from /api/prices; simplified here
        btc:  Number(startBtc)  / 1e8,
        link: Number(startLink) / 1e8,
        usdc: 1,
      },
      performanceScoreBps: fund.performanceScoreBps ?? 0,
      fundAgedays: Math.floor(
        (Date.now() / 1000 - Number(fund.createdAt)) / 86400,
      ),
    });
  }, [analysisHook, fund]);

  const handleAudit = useCallback(async () => {
    if (!("SHADOW_FUND_VAULT" in CONTRACTS)) return;
    const vaultAddr = (CONTRACTS as Record<string, string>).SHADOW_FUND_VAULT;
    const res = await fetch("/api/audit-contract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractAddress: vaultAddr }),
    });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      window.open(url, "_blank");
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 mx-auto max-w-2xl">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-60 rounded-2xl" />
      </div>
    );
  }

  if (!fund) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-text-body">Fund not found.</p>
        <Button asChild variant="outline">
          <Link href="/funds">Back to Funds</Link>
        </Button>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-text-body">Only the fund manager can access this page.</p>
        <Button asChild variant="outline">
          <Link href={`/fund/${fundId}`}>Back to Fund</Link>
        </Button>
      </div>
    );
  }

  const allPcts = [eth, btc, link, usdc];
  const total = allPcts.reduce((a, b) => a + b, 0);
  const nameMatches = typedName === fund.name;
  const canReveal = understood && nameMatches && countdown === 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href={`/fund/${fundId}`} className="text-sm text-text-muted hover:text-text-body">
        ← Back to Fund
      </Link>

      {fund.revealed ? (
        // Already revealed — show results + analysis
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: "var(--sf-reveal-bg)", border: "1px solid var(--sf-violet-border)" }}>
            <span className="text-2xl sf-reveal-animate">🔓</span>
            <div>
              <h2 className="text-lg font-bold text-text-heading">Strategy Revealed</h2>
              <p className="text-sm text-text-muted">This fund&apos;s strategy is now publicly visible.</p>
            </div>
          </div>

          {/* Allocation bars */}
          <Card className="rounded-2xl border" style={{ borderColor: "var(--sf-violet-border)" }}>
            <CardHeader className="px-5 pt-4 pb-0">
              <h3 className="text-sm font-semibold text-text-heading">Asset Allocation</h3>
            </CardHeader>
            <CardContent className="px-5 py-4">
              {fund.revealedStrategy && [
                { label: "ETH",  val: fund.revealedStrategy.eth  },
                { label: "BTC",  val: fund.revealedStrategy.btc  },
                { label: "LINK", val: fund.revealedStrategy.link },
                { label: "USDC", val: fund.revealedStrategy.usdc },
              ].map(({ label, val }, i) => (
                <div key={label} className="mb-3 flex items-center gap-3">
                  <span className="w-12 text-xs font-medium sf-reveal-animate" style={{ color: ASSET_COLORS[i] }}>
                    {label}
                  </span>
                  <div className="flex-1 rounded-full bg-surface" style={{ height: 10 }}>
                    <div
                      className="h-full rounded-full sf-reveal-animate"
                      style={{
                        width: `${val}%`,
                        background: ASSET_COLORS[i],
                        animationDelay: `${i * 150}ms`,
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-bold text-text-body">{val}%</span>
                </div>
              ))}
              {fund.performanceScoreBps !== null && (
                <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
                  style={{ background: "var(--sf-violet-subtle)", border: "1px solid var(--sf-violet-border)" }}>
                  <span className="text-sm text-text-muted">Performance Score</span>
                  <span className={`text-sm font-bold ${
                    fund.performanceScoreBps >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {(fund.performanceScoreBps / 100).toFixed(2)}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ChainGPT panel */}
          <ChainGptAnalysisPanel
            analysis={analysisHook.analysis}
            isLoading={analysisHook.isLoading}
            error={analysisHook.error}
            onAnalyze={handleAnalyze}
            onAudit={handleAudit}
            vaultAddress={
              ("SHADOW_FUND_VAULT" in CONTRACTS)
                ? (CONTRACTS as Record<string, string>).SHADOW_FUND_VAULT
                : undefined
            }
          />
        </div>
      ) : (
        // Pre-reveal — triple-confirm flow
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-text-heading">Reveal Strategy</h1>
            <p className="mt-1 text-text-body">
              This is a <strong>one-way, irreversible</strong> action. Once revealed, your strategy
              allocations will be publicly visible on-chain forever.
            </p>
          </div>

          {/* Plaintext entry */}
          <Card className="rounded-2xl border" style={{ borderColor: "var(--sf-violet-border)" }}>
            <CardHeader className="px-5 pt-4 pb-0">
              <h3 className="text-sm font-semibold text-text-heading">
                Enter your allocation percentages
              </h3>
              <p className="text-xs text-text-muted mt-1">
                You encrypted these — enter the same values (must sum to 100).
              </p>
            </CardHeader>
            <CardContent className="px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "ETH %", val: eth, set: setEth },
                  { label: "BTC %", val: btc, set: setBtc },
                  { label: "LINK %", val: link, set: setLink },
                  { label: "USDC %", val: usdc, set: setUsdc },
                ].map(({ label, val, set }, i) => (
                  <div key={label} className="flex flex-col gap-1">
                    <label className="text-xs text-text-muted">{label}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => set(Number(e.target.value))}
                      className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-400"
                      style={{ borderColor: "var(--sf-card-border)", borderLeftColor: ASSET_COLORS[i] }}
                    />
                  </div>
                ))}
              </div>
              <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium text-center ${
                total === 100 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }`}>
                Total: {total}% {total === 100 ? "✓" : `(${100 - total > 0 ? "+" : ""}${100 - total} off)`}
              </div>
            </CardContent>
          </Card>

          {/* Triple confirm */}
          <Card className="rounded-2xl border" style={{ borderColor: "var(--sf-violet-border)", background: "var(--sf-reveal-bg)" }}>
            <CardContent className="flex flex-col gap-4 px-5 py-5">
              {/* Step 1: checkbox */}
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-violet-500"
                />
                <span className="text-sm text-text-body">
                  I understand that revealing my strategy is{" "}
                  <strong className="text-text-heading">permanent and irreversible</strong>.
                  It will be publicly visible on-chain forever.
                </span>
              </label>

              {/* Step 2: type fund name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">
                  Type the fund name <strong className="text-text-heading">{fund.name}</strong> to confirm:
                </label>
                <input
                  className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-violet-400"
                  style={{ borderColor: nameMatches ? "var(--sf-violet)" : "var(--sf-card-border)" }}
                  placeholder={fund.name}
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                />
              </div>

              {/* Step 3: countdown button */}
              <Button
                className="w-full"
                style={{
                  background: canReveal ? "var(--sf-violet)" : undefined,
                  color: canReveal ? "#fff" : undefined,
                }}
                disabled={!understood || !nameMatches || total !== 100 || revealHook.step === "writing"}
                onClick={() => {
                  if (countdown === null) {
                    setCountdown(5);
                  } else if (countdown === 0) {
                    handleReveal();
                  }
                }}
              >
                {revealHook.step === "writing"
                  ? "Revealing..."
                  : countdown === null
                  ? "Start Reveal"
                  : countdown > 0
                  ? `Confirm in ${countdown}s...`
                  : "Confirm Reveal 🔓"}
              </Button>

              {revealHook.error && (
                <p className="text-sm text-red-400">{revealHook.error}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
