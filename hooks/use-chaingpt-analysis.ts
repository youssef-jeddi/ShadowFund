"use client";

import { useState, useCallback } from "react";

export interface StrategyAnalysis {
  summary: string;
  assetBreakdown: string;
  performanceInsights: string;
  riskAssessment: string;
  raw: string;
}

interface UseChainGptAnalysisResult {
  analysis: StrategyAnalysis | null;
  isLoading: boolean;
  error: string | null;
  analyze: (params: AnalyzeParams) => Promise<void>;
}

/**
 * 2-element allocation vector (basis points, sum 10_000).
 * Order: [Aave USDC, Fixed 8%].
 */
export type AllocationPair = [number, number];

export interface AnalyzeParams {
  fundName: string;
  /** Public allocation bps — [AaveUSDC, Fixed]. Sum = 10_000. */
  allocationBps: AllocationPair;
  /** Live supply APY as percent (e.g., 4.12) for each sub-vault, same order as allocation. */
  subVaultAPYs: AllocationPair;
  /** Total USDC deployed to sub-vaults (display scale: USDC units as number). */
  totalDeployedUsdc: number;
  /** Total fund TVL (wrapped cUSDC + deployed USDC), USDC units as number. */
  totalTvlUsdc: number;
  depositorCount: number;
  fundAgeHours: number;
}

export function useChainGptAnalysis(): UseChainGptAnalysisResult {
  const [analysis, setAnalysis] = useState<StrategyAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (params: AnalyzeParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as StrategyAnalysis;
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { analysis, isLoading, error, analyze };
}
