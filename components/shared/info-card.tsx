import type { ReactNode } from "react";

interface InfoCardProps {
  children: ReactNode;
  className?: string;
}

export function InfoCard({ children }: InfoCardProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          width: 22, height: 22,
          borderRadius: 999,
          border: "1px solid var(--border-strong)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          fontSize: 11,
          color: "var(--text-muted)",
          fontStyle: "italic",
          fontFamily: "var(--font-display)",
        }}
      >
        i
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          How it works
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
          {children}
        </p>
      </div>
    </div>
  );
}
