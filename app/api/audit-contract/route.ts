import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/audit-contract
 *
 * Triggers a ChainGPT smart contract audit for the ShadowFundVault.
 * Returns a URL to the audit results page (or a fallback Arbiscan link).
 *
 * Body: { contractAddress: string }
 * Response: { url: string, auditId?: string }
 */

const CHAINGPT_AUDIT_URL = "https://api.chaingpt.org/smart-contract-auditor";
const CHAINGPT_API_KEY = process.env.CHAINGPT_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const { contractAddress } = await req.json() as { contractAddress: string };

    if (!contractAddress) {
      return NextResponse.json({ error: "contractAddress required" }, { status: 400 });
    }

    if (!CHAINGPT_API_KEY) {
      // Fallback: link to Arbiscan contract page
      return NextResponse.json({
        url: `https://sepolia.arbiscan.io/address/${contractAddress}#code`,
        note: "ChainGPT API key not configured — linking to Arbiscan instead",
      });
    }

    const cgRes = await fetch(CHAINGPT_AUDIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHAINGPT_API_KEY}`,
      },
      body: JSON.stringify({
        contractAddress,
        network: "arbitrum-sepolia",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!cgRes.ok) {
      // Fallback to Arbiscan
      return NextResponse.json({
        url: `https://sepolia.arbiscan.io/address/${contractAddress}#code`,
        note: `ChainGPT audit API returned ${cgRes.status} — linking to Arbiscan instead`,
      });
    }

    const data = await cgRes.json() as { url?: string; auditId?: string; reportUrl?: string };
    return NextResponse.json({
      url: data.url ?? data.reportUrl ?? `https://sepolia.arbiscan.io/address/${contractAddress}#code`,
      auditId: data.auditId,
    });
  } catch (err) {
    console.error("/api/audit-contract error:", err);
    return NextResponse.json(
      { error: "Audit request failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
