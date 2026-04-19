interface ErrorMessageProps {
  error: string;
  onRetry: () => void;
  icon?: string;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <div
      style={{
        padding: "12px 16px",
        border: "1px solid var(--red)",
        background: "oklch(0.68 0.18 25 / 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "start" }}>
        <span style={{ fontSize: 14, color: "var(--red)", flexShrink: 0 }}>⚠</span>
        <p style={{ fontSize: 12, color: "var(--red)", lineHeight: 1.6, flex: 1 }}>{error}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          alignSelf: "flex-end",
          background: "none",
          border: "none",
          color: "var(--red)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Retry
      </button>
    </div>
  );
}
