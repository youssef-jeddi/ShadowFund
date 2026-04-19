import type { ReactNode } from "react";

interface KVProps {
  label: string;
  value: ReactNode;
  last?: boolean;
}

export function KV({ label, value, last = false }: KVProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "12px 0",
        borderBottom: last ? "none" : "1px solid var(--border)",
        gap: 16,
      }}
    >
      <span className="eyebrow">{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  );
}
