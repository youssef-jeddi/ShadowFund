"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDepositorPosition } from "@/hooks/use-depositor-position";
import { CONTRACTS } from "@/lib/contracts";

const vaultAddress = CONTRACTS.SHADOW_FUND_VAULT as `0x${string}`;

interface DepositorPositionCardProps {
  fundId: bigint;
  fundName?: string;
}

/**
 * Depositor's encrypted position summary. Calls `getDepositorHandles`
 * and decrypts both handles via `handleClient.decrypt` — only the
 * connected wallet has ACL.
 */
export function DepositorPositionCard({
  fundId,
  fundName,
}: DepositorPositionCardProps) {
  const { position, decrypting, error, decrypt } = useDepositorPosition(fundId);

  const sharesReady = position.sharesDecrypted !== null;
  const depositedReady = position.depositedDecrypted !== null;
  const bothReady = sharesReady && depositedReady;

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
          <span className="text-lg">🔒</span>
          <div>
            <h3 className="text-base font-semibold text-text-heading">
              Your Private Position
            </h3>
            <p className="text-xs text-text-muted">
              {fundName ? `In ${fundName} — ` : ""}
              Only your wallet can decrypt these numbers.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-5 py-4">
        {!bothReady && !decrypting && !error && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-xs text-text-muted">
              Decrypting your handles locally — the RPC returned opaque bytes32
              handles that only your wallet has ACL for.
            </p>
            <Button
              size="sm"
              className="text-xs"
              style={{ background: "var(--sf-violet)", color: "#fff" }}
              onClick={decrypt}
            >
              Decrypt Position
            </Button>
          </div>
        )}

        {decrypting && (
          <div className="flex items-center gap-2 py-2 text-xs text-text-muted">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--sf-violet)" }}
            />
            Decrypting…
          </div>
        )}

        {error && (
          <div className="flex flex-col gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <span>{error}</span>
            <button
              onClick={decrypt}
              className="self-start text-[11px] underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {bothReady && (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="You deposited" value={`${position.depositedDecrypted} cUSDC`} />
            <Stat label="Your shares" value={`${position.sharesDecrypted} sfUSDC`} />
            <Stat
              label="Yield (approx)"
              value={
                position.yieldDecrypted
                  ? `${Number(position.yieldDecrypted) >= 0 ? "+" : ""}${position.yieldDecrypted}`
                  : "—"
              }
            />
          </div>
        )}

        <div
          className="rounded-xl border px-3 py-2 text-[11px]"
          style={{
            borderColor: "var(--sf-violet-border)",
            background: "var(--sf-violet-subtle)",
            color: "var(--sf-violet-text)",
          }}
        >
          Only your wallet can decrypt this —
          {" "}
          <a
            href={`https://sepolia.arbiscan.io/address/${vaultAddress}#readContract`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            verify on Arbiscan
          </a>
          . The RPC only exposes opaque <code className="text-[10px]">bytes32</code> handles.
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-xl px-3 py-2"
      style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
    >
      <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-text-heading">{value}</span>
    </div>
  );
}
