"use client";

import { useFundList } from "@/hooks/use-fund-list";
import { FundCard } from "@/components/shadow-fund/fund-card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FundBrowserContent() {
  const { funds, isLoading, count } = useFundList();

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading md:text-3xl">
            ShadowFund Vaults
          </h1>
          <p className="mt-1 text-text-body">
            Confidential investment strategies powered by{" "}
            <span style={{ color: "var(--sf-violet-text)" }}>iExec Nox</span>.
            Strategy allocations stay encrypted until the manager reveals.
          </p>
        </div>
        <Button
          asChild
          className="shrink-0"
          style={{ background: "var(--sf-violet)", color: "#fff" }}
        >
          <Link href="/dashboard/manager">Create Fund</Link>
        </Button>
      </div>

      {/* Privacy callout */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
        style={{
          background: "var(--sf-card-bg)",
          border: "1px solid var(--sf-card-border)",
        }}
      >
        <span className="text-lg">🔒</span>
        <p className="text-text-body">
          <strong className="text-text-heading">What&apos;s private:</strong> strategy
          allocations, deposit amounts, individual balances.{" "}
          <strong className="text-text-heading">What&apos;s public:</strong> fund names,
          manager addresses, depositor count, performance score (post-reveal only).
        </p>
      </div>

      {/* Fund grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-16 text-center"
          style={{ borderColor: "var(--sf-card-border)" }}>
          <span className="text-4xl">🌑</span>
          <div>
            <p className="font-semibold text-text-heading">No funds yet</p>
            <p className="mt-1 text-sm text-text-muted">
              Be the first to create a confidential fund.
            </p>
          </div>
          <Button
            asChild
            style={{ background: "var(--sf-violet)", color: "#fff" }}
          >
            <Link href="/dashboard/manager">Create a Fund</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funds.map((fund) => (
            <FundCard key={fund.fundId.toString()} fund={fund} />
          ))}
        </div>
      )}
    </div>
  );
}
