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

export interface AnalyzeParams {
  fundName: string;
  strategy: { wethBps: number };
  startPriceEth: number;
  currentPriceEth: number;
  performanceScoreBps: number;
  aaveApyBps: number;
  realYield: number;
  principal: number;
  fundAgedays: number;
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
