import type { CSSProperties, ReactNode } from "react";

type TagTone = "neutral" | "accent" | "green" | "red" | "encrypted";

interface SfTagProps {
  children: ReactNode;
  tone?: TagTone;
  style?: CSSProperties;
}

const TONES: Record<TagTone, { bg: string; color: string; border: string }> = {
  neutral:   { bg: "var(--surface-2)",           color: "var(--text-dim)",  border: "var(--border)" },
  accent:    { bg: "oklch(0.92 0.02 90 / 0.08)", color: "var(--pearl)",     border: "oklch(0.92 0.02 90 / 0.3)" },
  green:     { bg: "oklch(0.78 0.14 155 / 0.08)",color: "var(--green)",     border: "oklch(0.78 0.14 155 / 0.25)" },
  red:       { bg: "oklch(0.68 0.18 25 / 0.08)", color: "var(--red)",       border: "oklch(0.68 0.18 25 / 0.25)" },
  encrypted: { bg: "transparent",                color: "var(--pearl)",     border: "oklch(0.92 0.02 90 / 0.3)" },
};

export function SfTag({ children, tone = "neutral", style = {} }: SfTagProps) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontWeight: 500,
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        borderRadius: 2,
        ...style,
      }}
    >
      {tone === "encrypted" && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <rect x="1.5" y="3.5" width="5" height="4" stroke="currentColor" strokeWidth="0.8" fill="none"/>
          <path d="M2.5 3.5V2.2a1.5 1.5 0 0 1 3 0v1.3" stroke="currentColor" strokeWidth="0.8" fill="none"/>
        </svg>
      )}
      {children}
    </span>
  );
}
