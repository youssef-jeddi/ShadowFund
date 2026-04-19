interface AddressChipProps {
  addr?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: 11, md: 12, lg: 13 };

export function AddressChip({ addr = "0x0000...0000", size = "md" }: AddressChipProps) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: SIZES[size],
        color: "var(--text-dim)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 10, background: "var(--pearl)", flexShrink: 0 }} />
      {addr}
    </span>
  );
}
