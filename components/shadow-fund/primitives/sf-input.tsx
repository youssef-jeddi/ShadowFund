import type { InputHTMLAttributes } from "react";

interface SfInputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export function SfInput({ mono = false, style = {}, ...props }: SfInputProps) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        padding: "12px 14px",
        fontSize: 14,
        color: "var(--text)",
        outline: "none",
        borderRadius: 2,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
        ...style,
      }}
    />
  );
}
