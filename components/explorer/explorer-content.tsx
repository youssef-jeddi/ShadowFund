"use client";

import { useMemo, useState } from "react";
import { ActivityTable } from "./activity-table";
import { useActivityHistory } from "@/hooks/use-activity-history";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import { SfTag } from "@/components/shadow-fund/primitives/sf-tag";
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_CONFIG,
  type ActivityType,
} from "@/lib/activity";

const ITEMS_PER_PAGE = 10;

type FilterValue = "all" | ActivityType;

const FILTER_OPTIONS: { label: string; value: FilterValue }[] = [
  { label: "All Actions", value: "all" },
  ...ACTIVITY_TYPES.map((type) => ({
    label: ACTIVITY_TYPE_CONFIG[type].label,
    value: type as FilterValue,
  })),
];

export function ExplorerContent() {
  const { entries, isLoading, error } = useActivityHistory();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? entries
        : entries.filter((a) => a.type === filter),
    [filter, entries],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  function handleFilterChange(value: FilterValue) {
    setFilter(value);
    setPage(1);
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "56px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 40 }}>
        <div>
          <Eyebrow>ShadowFund · On-chain events</Eyebrow>
          <h1
            className="display"
            style={{ fontSize: 64, marginTop: 14, letterSpacing: "-0.028em", lineHeight: 1 }}
          >
            Activity
            <span className="display-italic" style={{ color: "var(--pearl)" }}>.</span>
          </h1>
          <p style={{ color: "var(--text-dim)", marginTop: 10, fontSize: 15 }}>
            Monitor your confidential transactions on the iExec Nox network.
          </p>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="eyebrow">Filter</span>
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value as FilterValue)}
            aria-label="Filter by action type"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--text)",
              borderRadius: 2,
              outline: "none",
              cursor: "pointer",
            }}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: "var(--surface)" }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "48px 0" }}>
          Loading activity…
        </div>
      ) : error ? (
        <div
          style={{
            padding: "48px 32px",
            textAlign: "center",
            border: "1px solid var(--red)",
            background: "oklch(0.68 0.18 25 / 0.05)",
          }}
        >
          <div style={{ color: "var(--red)", fontSize: 14 }}>Failed to load activity</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>{error}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "64px 32px",
            textAlign: "center",
            border: "1px dashed var(--border)",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>No transactions yet</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>
            Wrap some tokens to get started
          </div>
        </div>
      ) : (
        <>
          <ActivityTable entries={paginated} />

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 24,
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Showing {paginated.length} of {filtered.length} transactions
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  color: page <= 1 ? "var(--text-muted)" : "var(--text)",
                  padding: "4px 10px",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  fontSize: 12,
                  borderRadius: 2,
                  opacity: page <= 1 ? 0.4 : 1,
                }}
              >
                ←
              </button>
              <span
                className="mono"
                style={{
                  padding: "4px 12px",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  borderRadius: 2,
                  background: "var(--surface)",
                }}
              >
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  color: page >= totalPages ? "var(--text-muted)" : "var(--text)",
                  padding: "4px 10px",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  fontSize: 12,
                  borderRadius: 2,
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >
                →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
