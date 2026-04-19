import type { CSSProperties, ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  dot?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function Eyebrow({ children, dot = false, style = {}, className = "" }: EyebrowProps) {
  return (
    <div
      className={`eyebrow ${className}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            background: "var(--pearl)",
            borderRadius: 10,
            animation: "blink 2s infinite",
          }}
        />
      )}
      {children}
    </div>
  );
}
