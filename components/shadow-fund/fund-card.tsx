"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/utils";
import type { FundMetadata } from "@/hooks/use-fund-list";

interface FundCardProps {
  fund: FundMetadata;
}

function FundAge({ createdAt }: { createdAt: bigint }) {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const ageSec = nowSec - createdAt;
  const ageDays = Number(ageSec / 86400n);
  if (ageDays === 0) return <span>Today</span>;
  return <span>{ageDays}d old</span>;
}

export function FundCard({ fund }: FundCardProps) {
  return (
    <Card
      style={{
        background: "var(--sf-card-bg)",
        borderColor: "var(--sf-card-border)",
      }}
      className="flex flex-col gap-0 rounded-2xl border"
    >
      <CardHeader className="px-5 pt-5 pb-0">
        <div className="flex items-start justify-between gap-2">
          {/* Name + manager */}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-text-heading">
              {fund.name}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-text-muted">
              {truncateAddress(fund.manager)}
            </p>
          </div>

          {/* Status badge */}
          {fund.revealed ? (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              Revealed
            </span>
          ) : (
            <span
              className="sf-sealed-badge shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium"
              style={{ WebkitTextFillColor: "var(--sf-sealed)" }}
            >
              Sealed
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 px-5 py-4">
        {/* Description */}
        {fund.description && (
          <p className="line-clamp-2 text-sm text-text-body">{fund.description}</p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Age"
            value={<FundAge createdAt={fund.createdAt} />}
          />
          <Stat
            label="Depositors"
            value={fund.depositorCount.toString()}
          />
          <Stat
            label="TVL"
            value={
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: "var(--sf-violet)" }}
                />
                Encrypted
              </span>
            }
          />
        </div>

        {/* Performance score (post-reveal only) */}
        {fund.revealed ? (
          <div
            className="rounded-xl px-3 py-2 text-sm"
            style={{
              background: "var(--sf-reveal-bg)",
              border: "1px solid var(--sf-violet-border)",
            }}
          >
            <span className="text-text-muted">Performance: </span>
            <span
              className="font-semibold"
              style={{ color: "var(--sf-violet-text)" }}
            >
              Score available
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed px-3 py-2 text-sm"
            style={{ borderColor: "var(--sf-violet-border)" }}>
            <span className="text-text-muted">Strategy hidden — </span>
            <span className="text-text-muted italic">waiting for reveal</span>
          </div>
        )}

        {/* Fee */}
        <p className="text-xs text-text-muted">
          Performance fee:{" "}
          <span className="text-text-body">
            {(Number(fund.performanceFeeBps) / 100).toFixed(2)}%
          </span>
        </p>

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          <Button
            asChild
            variant="outline"
            className="flex-1 text-sm"
            style={{ borderColor: "var(--sf-violet-border)", color: "var(--sf-violet-text)" }}
          >
            <Link href={`/fund/${fund.fundId}`}>View Fund</Link>
          </Button>
          <Button
            asChild
            className="flex-1 text-sm"
            style={{ background: "var(--sf-violet)", color: "#fff" }}
          >
            <Link href={`/fund/${fund.fundId}`}>Deposit</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5"
      style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
    >
      <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
      <span className="text-xs font-medium text-text-body">{value}</span>
    </div>
  );
}
