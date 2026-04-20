import { NextRequest, NextResponse } from "next/server";

const CHAINGPT_API_URL = "https://api.chaingpt.org/chat/stream";
const CHAINGPT_API_KEY = process.env.CHAINGPT_API_KEY ?? "";

type AllocationPair = [number, number];

interface AnalyzeBody {
  fundName: string;
  allocationBps: AllocationPair;
  subVaultAPYs: AllocationPair;
  totalDeployedUsdc: number;
  totalTvlUsdc: number;
  depositorCount: number;
  fundAgeHours: number;
}

const SLOT_LABELS = ["Aave USDC", "Fixed 8%"];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeBody;
    const prompt = buildPrompt(body);

    if (!CHAINGPT_API_KEY) {
      return NextResponse.json(getFallbackAnalysis(body), { status: 200 });
    }

    const systemInstruction =
      "You are a DeFi fund analyst. Analyze a ShadowFund vault that allocates across 2 USDC-only sub-vaults (Aave v3 USDC supply, Fixed 8% reward pool). The manager's allocation mix is fully public on-chain; only individual depositor position sizes are encrypted (input privacy via iExec Nox). Return a JSON object with keys: summary, assetBreakdown, performanceInsights, riskAssessment. Each value is 2-3 sentences. Respond ONLY with valid JSON.";

    const cgRes = await fetch(CHAINGPT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHAINGPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "general_assistant",
        question: `${systemInstruction}\n\n${prompt}`,
        chatHistory: "off",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!cgRes.ok) {
      const errText = await cgRes.text();
      console.error("ChainGPT error:", cgRes.status, errText);
      return NextResponse.json(getFallbackAnalysis(body), { status: 200 });
    }

    const bodyText = await cgRes.text();
    const contentType = cgRes.headers.get("content-type") ?? "";

    let rawText = bodyText;
    if (contentType.includes("text/event-stream") || bodyText.startsWith("data:")) {
      rawText = bodyText
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.replace(/^data:\s*/, "").trim())
        .filter((l) => l && l !== "[DONE]")
        .join("");
    } else if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(bodyText) as {
          data?: { bot?: string };
          bot?: string;
          choices?: Array<{ message?: { content?: string }; text?: string }>;
          text?: string;
        };
        rawText =
          json.data?.bot ??
          json.bot ??
          json.choices?.[0]?.message?.content ??
          json.choices?.[0]?.text ??
          json.text ??
          bodyText;
      } catch {
        rawText = bodyText;
      }
    }

    let parsed: {
      summary?: unknown;
      assetBreakdown?: unknown;
      performanceInsights?: unknown;
      riskAssessment?: unknown;
    } = {};
    try {
      const stripped = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
      }
    } catch {
      // If parsing fails, fall back to template with raw as summary
    }

    const fallback = getFallbackAnalysis(body);
    return NextResponse.json({
      summary: coerceToString(parsed.summary) ?? (rawText.slice(0, 300) || fallback.summary),
      assetBreakdown: coerceToString(parsed.assetBreakdown) ?? fallback.assetBreakdown,
      performanceInsights: coerceToString(parsed.performanceInsights) ?? fallback.performanceInsights,
      riskAssessment: coerceToString(parsed.riskAssessment) ?? fallback.riskAssessment,
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

function coerceToString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => coerceToString(x) ?? "").filter(Boolean).join("\n");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${coerceToString(val) ?? ""}`)
      .join("\n");
  }
  return undefined;
}

function fmtAllocation(pair: AllocationPair): string {
  return SLOT_LABELS.map((label, i) => `${label} ${(pair[i] / 100).toFixed(0)}%`).join(" / ");
}

function fmtApys(pair: AllocationPair): string {
  return SLOT_LABELS.map((label, i) => `${label} ${(pair[i] / 100).toFixed(2)}%`).join(" / ");
}

function blendedApyPct(allocation: AllocationPair, apys: AllocationPair): number {
  return (allocation[0] * apys[0] + allocation[1] * apys[1]) / 1_000_000;
}

function apyPct(bps: number): number {
  return bps / 100;
}

function buildPrompt(body: AnalyzeBody): string {
  const {
    fundName,
    allocationBps,
    subVaultAPYs,
    totalDeployedUsdc,
    totalTvlUsdc,
    depositorCount,
    fundAgeHours,
  } = body;

  const blendedPct = blendedApyPct(allocationBps, subVaultAPYs).toFixed(2);
  const allAavePct = apyPct(subVaultAPYs[0]).toFixed(2);

  return `
Fund Name: ${fundName}
Fund Age: ${fundAgeHours.toFixed(1)} hours
Depositor Count: ${depositorCount}
Total TVL: ${totalTvlUsdc.toFixed(2)} USDC
Total Deployed: ${totalDeployedUsdc.toFixed(2)} USDC

Public Allocation (basis points, sum 10000):
  ${fmtAllocation(allocationBps)}

Live Sub-Vault APYs:
  ${fmtApys(subVaultAPYs)}

Derived Figures:
  Blended APY (current mix):      ${blendedPct}%
  All-Aave baseline APY:          ${allAavePct}%

Privacy model: input privacy. Depositor positions (amount deposited, share balance, yield) are encrypted end-to-end via iExec Nox — only the depositor's wallet can decrypt. The manager's allocation is fully public.

Analyze and return JSON with these four sections (2-3 sentences each):
1. summary — overall strategy posture and how it compares to parking 100% in Aave v3 USDC
2. assetBreakdown — per-sub-vault yield attribution: how each slice's APY × allocation contributes to the blended yield
3. performanceInsights — blended return vs all-Aave baseline, commenting on whether the Fixed 8% pool's fixed-rate advantage justifies its inclusion given the ${allAavePct}% variable Aave APY
4. riskAssessment — smart-contract surface (Aave v3 + FixedYieldVault reward pool + iExec Nox ACLs), reward-pool depth risk for the Fixed leg (it's a finite seeded pool, not an on-chain yield source), and the privacy trade-off (manager strategy is transparent by design; only depositor amounts are private)
`.trim();
}

function getFallbackAnalysis(body: AnalyzeBody) {
  const {
    allocationBps,
    subVaultAPYs,
    totalDeployedUsdc,
    totalTvlUsdc,
    depositorCount,
  } = body;

  const blended = blendedApyPct(allocationBps, subVaultAPYs).toFixed(2);
  const allAave = apyPct(subVaultAPYs[0]).toFixed(2);
  const alpha = (Number(blended) - Number(allAave)).toFixed(2);
  const fixedTilt = allocationBps[1] >= 5000;

  return {
    summary: `This fund publicly commits to a ${fmtAllocation(allocationBps)} mix across Aave v3 USDC and a fixed-8% reward pool, delivering a blended ${blended}% APY. Individual depositor positions are encrypted end-to-end via iExec Nox — ${depositorCount} depositor(s) contribute ${totalTvlUsdc.toFixed(2)} USDC of TVL with no observable per-wallet amounts on-chain.`,
    assetBreakdown: `Capital splits across two USDC-only yield sources: Aave v3 supply (variable ~${allAave}% APY) and a deployer-seeded 8% fixed-rate pool. With ${totalDeployedUsdc.toFixed(2)} USDC actively deployed, each slice contributes pro-rata to the ${blended}% blended yield — the ${allocationBps[1] / 100}% Fixed allocation adds a yield floor that smooths Aave's variable rate.`,
    performanceInsights: `The blended ${blended}% APY ${Number(alpha) >= 0 ? "beats" : "trails"} the all-Aave baseline (${allAave}%) by ${alpha} percentage points — pure allocation alpha from tilting toward the fixed-rate leg. ${fixedTilt ? "The Fixed-heavy tilt optimizes for yield stability at the cost of upside when Aave rates spike." : "The Aave-heavy tilt keeps exposure to variable-rate upside while still floor-anchoring via the fixed pool."}`,
    riskAssessment: `Smart-contract surface is concentrated in Aave v3 USDC + our FixedYieldVault reward pool + iExec Nox ACL machinery. The Fixed leg is a finite deployer-seeded pool (not an on-chain yield source), so its APY holds only while the pool has depth. Privacy-wise, the manager's allocation is intentionally public — only depositor position sizes are encrypted, making whales indistinguishable from retail on-chain.`,
    raw: "(ChainGPT API key not set — showing template analysis)",
  };
}
