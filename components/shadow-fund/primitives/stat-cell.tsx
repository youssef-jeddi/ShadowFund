import type { ReactNode } from "react";

interface StatCellProps {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "green" | "pearl" | "default";
  last?: boolean;
  noBorderBottom?: boolean;
}

export function StatCell({ label, value, sub, tone = "default", last = false, noBorderBottom = false }: StatCellProps) {
  const color =
    tone === "green" ? "var(--green)" :
    tone === "pearl" ? "var(--pearl)" :
    "var(--text)";

  return (
    <div
      style={{
        padding: "40px 28px",
        borderRight: last ? "none" : "1px solid var(--border)",
        borderBottom: noBorderBottom ? "none" : "1px solid var(--border)",
      }}
    >
      <div className="eyebrow">{label}</div>
      <div className="display" style={{ fontSize: 28, marginTop: 10, fontWeight: 500, color }}>
        {value}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
