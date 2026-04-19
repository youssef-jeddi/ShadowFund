import type { ActivityEntry } from "@/lib/activity";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/activity";
import { ARBISCAN_BASE_URL } from "@/lib/config";
import { SfTag } from "@/components/shadow-fund/primitives/sf-tag";

interface ActivityTableProps {
  entries: ActivityEntry[];
}

function activityTone(type: string): "green" | "accent" | "red" | "neutral" | "encrypted" {
  if (type === "wrap") return "green";
  if (type === "unwrap") return "accent";
  if (type === "transfer") return "neutral";
  if (type === "grant_access" || type === "revoke_access") return "encrypted";
  return "neutral";
}

export function ActivityTable({ entries }: ActivityTableProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        background: "var(--border)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
          background: "var(--bg-2)",
          padding: "14px 20px",
        }}
      >
        {["Action", "Asset", "Amount", "Time", "Details"].map((col) => (
          <div key={col} className="eyebrow">
            {col}
          </div>
        ))}
      </div>
      {entries.map((entry) => (
        <ActivityRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const config = ACTIVITY_TYPE_CONFIG[entry.type];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
        alignItems: "center",
        padding: "18px 20px",
        background: "var(--surface)",
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
    >
      {/* Action */}
      <div>
        <SfTag tone={activityTone(entry.type)}>{config.label}</SfTag>
      </div>
      {/* Asset */}
      <div className="mono" style={{ fontSize: 13 }}>{entry.asset}</div>
      {/* Amount */}
      <div className="mono tabular" style={{ fontSize: 13 }}>{entry.amount}</div>
      {/* Time */}
      <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{entry.timestamp}</div>
      {/* Details */}
      <div>
        <a
          href={`${ARBISCAN_BASE_URL}/tx/${entry.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            color: "var(--pearl)",
            textDecoration: "none",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Arbiscan ↗
        </a>
      </div>
    </div>
  );
}
