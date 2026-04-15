import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/analyze-strategy
 *
 * Accepts a revealed 2-asset (WETH/USDC) fund strategy + Aave yield data and
 * returns a ChainGPT-powered natural language analysis of the fund's performance
 * across two dimensions:
 *   (a) real yield captured from Aave v3 USDC supply
 *   (b) allocation alpha — the revealed WETH bps vs a 50/50 benchmark over the
 *       period, using Chainlink ETH/USD delta
 *
 * Body (see AnalyzeParams in hooks/use-chaingpt-analysis.ts):
 *   {
 *     fundName: string,
 *     strategy: { wethBps: number },            // 0-10000
 *     startPriceEth: number,                    // USD
 *     currentPriceEth: number,                  // USD
 *     performanceScoreBps: number,              // allocation alpha in bps
 *     aaveApyBps: number,                       // current Aave USDC supply APY
 *     realYield: number,                        // USDC units (6-decimals plaintext)
 *     principal: number,                        // USDC units currently supplied
 *     fundAgedays: number,
 *   }
 */

const CHAINGPT_API_URL = "https://api.chaingpt.org/chat/stream";
const CHAINGPT_API_KEY = process.env.CHAINGPT_API_KEY ?? "";

interface AnalyzeBody {
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeBody;
    const prompt = buildPrompt(body);

    if (!CHAINGPT_API_KEY) {
      return NextResponse.json(getFallbackAnalysis(body), { status: 200 });
    }

    const cgRes = await fetch(CHAINGPT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHAINGPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "chaingpt",
        messages: [
          {
            role: "system",
            content:
              "You are a DeFi fund analyst. Analyze a 2-asset confidential fund (WETH + USDC) that supplies its productive capital to Aave v3 for real yield and scores the revealed WETH allocation against a 50/50 benchmark. Return a JSON object with keys: summary, assetBreakdown, performanceInsights, riskAssessment. Each value is 2-3 sentences. Respond ONLY with valid JSON.",
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

    let rawText: string;
    const contentType = cgRes.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
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
      const json = (await cgRes.json()) as {
        choices?: Array<{ message?: { content?: string }; text?: string }>;
        text?: string;
      };
      rawText =
        json.choices?.[0]?.message?.content ??
        json.choices?.[0]?.text ??
        json.text ??
        "";
    }

    let parsed: {
      summary?: string;
      assetBreakdown?: string;
      performanceInsights?: string;
      riskAssessment?: string;
    } = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
      }
    } catch {
      // If parsing fails, fall back to fallback template with raw as summary
    }

    const fallback = getFallbackAnalysis(body);
    return NextResponse.json({
      summary: parsed.summary ?? (rawText.slice(0, 300) || fallback.summary),
      assetBreakdown: parsed.assetBreakdown ?? fallback.assetBreakdown,
      performanceInsights: parsed.performanceInsights ?? fallback.performanceInsights,
      riskAssessment: parsed.riskAssessment ?? fallback.riskAssessment,
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

function buildPrompt(body: AnalyzeBody): string {
  const {
    fundName,
    strategy,
    startPriceEth,
    currentPriceEth,
    performanceScoreBps,
    aaveApyBps,
    realYield,
    principal,
    fundAgedays,
  } = body;

  const wethPct = (strategy.wethBps / 100).toFixed(0);
  const usdcPct = ((10_000 - strategy.wethBps) / 100).toFixed(0);
  const ethDeltaPct = (
    ((currentPriceEth - startPriceEth) / (startPriceEth || 1)) *
    100
  ).toFixed(2);
  const alphaPct = (performanceScoreBps / 100).toFixed(2);
  const apyPct = (aaveApyBps / 100).toFixed(2);
  const yieldUsdc = (realYield / 1e6).toFixed(4);
  const principalUsdc = (principal / 1e6).toFixed(2);

  return `
Fund Name: ${fundName}
Fund Age: ${fundAgedays} days

Revealed Strategy (2-asset basket):
  WETH: ${wethPct}% (virtual allocation — used for alpha scoring)
  USDC: ${usdcPct}% (virtual allocation)

Capital Deployment (real):
  100% of productive capital is supplied to Aave v3 USDC reserve.
  Current Aave USDC supply APY: ${apyPct}%
  Principal currently supplied: ${principalUsdc} USDC
  Realized real yield so far:   ${yieldUsdc} USDC

Allocation Alpha (vs 50/50 benchmark):
  ETH price delta over period: ${ethDeltaPct}%
  Manager's alpha score:       ${alphaPct}% (positive = beat 50/50 hold)

The fund is confidential: the strategy was encrypted on-chain until now.
Analyze and return JSON with these four sections (2-3 sentences each):
1. summary — overall approach and outcome
2. assetBreakdown — how the WETH/USDC split would have performed vs the real USDC-in-Aave deployment
3. performanceInsights — real Aave yield AND allocation alpha combined
4. riskAssessment — risk profile given the virtual allocation and real capital routing
`.trim();
}

function getFallbackAnalysis(body: AnalyzeBody) {
  const { strategy, performanceScoreBps, aaveApyBps, realYield, principal } = body;
  const wethPct = (strategy.wethBps / 100).toFixed(0);
  const usdcPct = ((10_000 - strategy.wethBps) / 100).toFixed(0);
  const alpha = (performanceScoreBps / 100).toFixed(2);
  const apy = (aaveApyBps / 100).toFixed(2);
  const yieldUsdc = (realYield / 1e6).toFixed(4);
  const principalUsdc = (principal / 1e6).toFixed(2);
  const alphaPositive = performanceScoreBps >= 0;

  return {
    summary: `This fund committed a ${wethPct}% WETH / ${usdcPct}% USDC virtual allocation and routed 100% of productive capital to Aave v3 USDC, where it accrues real yield at the current supply APY of ${apy}%. The manager ${alphaPositive ? "outperformed" : "underperformed"} a 50/50 WETH-USDC benchmark by ${alpha}% on allocation alpha.`,
    assetBreakdown: `The revealed ${wethPct}% WETH claim is scored against Chainlink ETH/USD — no physical WETH exposure was taken. All capital (${principalUsdc} USDC principal) sits in Aave's USDC reserve, earning lending yield (${yieldUsdc} USDC realized so far).`,
    performanceInsights: `Depositors earn real Aave yield regardless of the manager's allocation claim; the WETH bps only affects the allocation alpha score. With a ${alpha}% alpha and ${yieldUsdc} USDC of realized yield, the combined edge is ${alphaPositive ? "meaningfully positive" : "negative on allocation but still earning base yield"}.`,
    riskAssessment: `Smart-contract risk is dominated by Aave v3 + iExec Nox confidential contracts. No DEX slippage, no bridging — capital is fully in-protocol on Arbitrum Sepolia. The virtual WETH bet is costless on the downside; the only loss vector beyond Aave itself is reputational (a revealed miss vs the benchmark).`,
    raw: "(ChainGPT API key not set — showing template analysis)",
  };
}
