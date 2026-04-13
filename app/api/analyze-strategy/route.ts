import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/analyze-strategy
 *
 * Accepts a revealed fund strategy + price data and returns a ChainGPT-powered
 * natural language analysis of the fund's performance.
 *
 * Body:
 *   {
 *     fundName: string,
 *     strategy: { eth: number, btc: number, link: number, usdc: number },
 *     startPrices: { eth, btc, link, usdc } (in USD),
 *     currentPrices: { eth, btc, link, usdc } (in USD),
 *     performanceScoreBps: number,
 *     fundAgedays: number,
 *   }
 *
 * Response (StrategyAnalysis):
 *   {
 *     summary: string,
 *     assetBreakdown: string,
 *     performanceInsights: string,
 *     riskAssessment: string,
 *     raw: string,
 *   }
 */

const CHAINGPT_API_URL = "https://api.chaingpt.org/chat/stream";
const CHAINGPT_API_KEY = process.env.CHAINGPT_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      fundName: string;
      strategy: { eth: number; btc: number; link: number; usdc: number };
      startPrices: { eth: number; btc: number; link: number; usdc: number };
      currentPrices: { eth: number; btc: number; link: number; usdc: number };
      performanceScoreBps: number;
      fundAgedays: number;
    };

    const prompt = buildPrompt(body);

    if (!CHAINGPT_API_KEY) {
      return NextResponse.json(getFallbackAnalysis(body), { status: 200 });
    }

    // Call ChainGPT chat API
    const cgRes = await fetch(CHAINGPT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHAINGPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "chaingpt",
        messages: [
          {
            role: "system",
            content:
              "You are a DeFi fund analyst. Analyze the provided confidential fund strategy and return a JSON object with keys: summary, assetBreakdown, performanceInsights, riskAssessment. Each value is a 2-3 sentence plain text paragraph. Respond ONLY with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!cgRes.ok) {
      const errText = await cgRes.text();
      console.error("ChainGPT error:", cgRes.status, errText);
      return NextResponse.json(getFallbackAnalysis(body), { status: 200 });
    }

    // Parse response — ChainGPT may return streaming or JSON
    let rawText: string;
    const contentType = cgRes.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
      // SSE streaming — collect all data chunks
      const reader = cgRes.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
        }
      }
      rawText = accumulated
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.replace("data:", "").trim())
        .filter((l) => l && l !== "[DONE]")
        .join("");
    } else {
      const json = await cgRes.json() as { choices?: Array<{ message?: { content?: string }; text?: string }>; text?: string };
      rawText =
        json.choices?.[0]?.message?.content ??
        json.choices?.[0]?.text ??
        json.text ??
        "";
    }

    // Try to parse the JSON response from ChainGPT
    let parsed: { summary?: string; assetBreakdown?: string; performanceInsights?: string; riskAssessment?: string } = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
      }
    } catch {
      // If parsing fails, use the raw text as summary
    }

    return NextResponse.json({
      summary: parsed.summary ?? (rawText.slice(0, 300) || getFallbackAnalysis(body).summary),
      assetBreakdown: parsed.assetBreakdown ?? getFallbackAnalysis(body).assetBreakdown,
      performanceInsights: parsed.performanceInsights ?? getFallbackAnalysis(body).performanceInsights,
      riskAssessment: parsed.riskAssessment ?? getFallbackAnalysis(body).riskAssessment,
      raw: rawText,
    });
  } catch (err) {
    console.error("/api/analyze-strategy error:", err);
    return NextResponse.json(
      { error: "Analysis failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

function buildPrompt(body: {
  fundName: string;
  strategy: { eth: number; btc: number; link: number; usdc: number };
  startPrices: { eth: number; btc: number; link: number; usdc: number };
  currentPrices: { eth: number; btc: number; link: number; usdc: number };
  performanceScoreBps: number;
  fundAgedays: number;
}): string {
  const { fundName, strategy, startPrices, currentPrices, performanceScoreBps, fundAgedays } = body;
  const score = (performanceScoreBps / 100).toFixed(2);

  const priceChanges = {
    eth:  ((currentPrices.eth  - startPrices.eth)  / (startPrices.eth  || 1) * 100).toFixed(2),
    btc:  ((currentPrices.btc  - startPrices.btc)  / (startPrices.btc  || 1) * 100).toFixed(2),
    link: ((currentPrices.link - startPrices.link) / (startPrices.link || 1) * 100).toFixed(2),
    usdc: "0.00",
  };

  return `
Fund Name: ${fundName}
Fund Age: ${fundAgedays} days
Performance Score: ${score}% (weighted by allocation)

Strategy Allocation:
  ETH:  ${strategy.eth}%  (price change: ${priceChanges.eth}%)
  BTC:  ${strategy.btc}%  (price change: ${priceChanges.btc}%)
  LINK: ${strategy.link}% (price change: ${priceChanges.link}%)
  USDC: ${strategy.usdc}% (stable, 0% change)

This was a confidential fund — the strategy was hidden from depositors until now.
Analyze the strategy and provide:
1. A summary of the overall approach
2. A breakdown of how each asset contributed to performance
3. Performance insights — was this a good allocation given the market conditions?
4. Risk assessment — was this a balanced or risky portfolio?
`.trim();
}

function getFallbackAnalysis(body: {
  fundName: string;
  strategy: { eth: number; btc: number; link: number; usdc: number };
  performanceScoreBps: number;
  fundAgedays: number;
}) {
  const { strategy, performanceScoreBps } = body;
  const score = (performanceScoreBps / 100).toFixed(2);
  const isPositive = performanceScoreBps >= 0;

  return {
    summary: `This fund held a diversified crypto portfolio with ${strategy.eth}% ETH, ${strategy.btc}% BTC, ${strategy.link}% LINK, and ${strategy.usdc}% USDC. The overall performance score was ${score}%, ${isPositive ? "outperforming" : "underperforming"} a flat USDC hold.`,
    assetBreakdown: `ETH (${strategy.eth}%) and BTC (${strategy.btc}%) formed the core volatile exposure. LINK (${strategy.link}%) provided additional upside from oracle infrastructure demand. USDC (${strategy.usdc}%) provided stability and reduced overall drawdown.`,
    performanceInsights: `With a ${score}% return over the fund period, the strategy ${isPositive ? "generated positive alpha" : "experienced a drawdown"}. The allocation across four assets reduced single-asset concentration risk.`,
    riskAssessment: `The portfolio maintained ${strategy.usdc}% in stablecoins as a defensive position. Combined crypto exposure was ${100 - strategy.usdc}%, making this a ${strategy.usdc >= 40 ? "moderately" : "highly"} risk-on fund. Suitable for investors with a ${strategy.usdc >= 40 ? "medium" : "high"} risk tolerance.`,
    raw: "(ChainGPT API key not set — showing template analysis)",
  };
}
