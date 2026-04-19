"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface SfButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
  className?: string;
}

const SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "7px 14px", fontSize: 12 },
  md: { padding: "11px 20px", fontSize: 13 },
  lg: { padding: "15px 28px", fontSize: 14 },
};

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary:   { background: "var(--pearl)",    color: "oklch(0.16 0.01 60)", borderColor: "var(--pearl)" },
  secondary: { background: "transparent",     color: "var(--text)",         borderColor: "var(--border-strong)" },
  ghost:     { background: "transparent",     color: "var(--text-dim)",     borderColor: "transparent" },
};

const HOVER: Record<ButtonVariant, CSSProperties> = {
  primary:   { background: "oklch(0.96 0.02 90)", transform: "translateY(-1px)" },
  secondary: { borderColor: "var(--pearl)", color: "var(--pearl)" },
  ghost:     { color: "var(--text)" },
};

export function SfButton({
  children,
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  style = {},
  type = "button",
  className = "",
}: SfButtonProps) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontWeight: 500,
        fontFamily: "var(--font-ui)",
        borderRadius: 2,
        border: "1px solid transparent",
        transition: "all 180ms",
        whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...SIZES[size],
        ...VARIANTS[variant],
        ...(hover && !disabled ? HOVER[variant] : {}),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
