"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

interface SfCardProps {
  children: ReactNode;
  style?: CSSProperties;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SfCard({ children, style = {}, interactive = false, onClick, className = "" }: SfCardProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 3,
        transition: "all 220ms",
        cursor: interactive ? "pointer" : "default",
        ...(interactive && hover ? { borderColor: "var(--border-strong)", transform: "translateY(-2px)" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
