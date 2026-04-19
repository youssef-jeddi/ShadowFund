interface SfLogoProps {
  size?: number;
  withWordmark?: boolean;
  color?: string;
}

export function SfLogo({ size = 22, withWordmark = true, color = "var(--pearl)" }: SfLogoProps) {
  const s = size * 1.1;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        {/* offset shadow mark */}
        <path d="M5 4 L19 4 L19 12 L14 12 L14 20 L5 20 Z" fill={color} opacity="0.3" />
        {/* primary mark: inverted L / stealth F */}
        <path d="M2 2 L16 2 L16 10 L11 10 L11 18 L2 18 Z" fill={color} />
        <path d="M6 6 L12 6 L12 8 L6 8 Z" fill="var(--background)" />
      </svg>
      {withWordmark && (
        <span
          className="mono"
          style={{
            fontSize: size * 0.66,
            fontWeight: 500,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--text)",
          }}
        >
          shadow<span style={{ color }}>&#47;</span>fund
        </span>
      )}
    </div>
  );
}
