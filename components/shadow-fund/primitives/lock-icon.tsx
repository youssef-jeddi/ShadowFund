interface LockIconProps {
  size?: number;
  open?: boolean;
}

export function LockIcon({ size = 12, open = false }: LockIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="5.2" width="8" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1" fill="none" />
      {open ? (
        <path d="M3.8 5.2V3.5a2.2 2.2 0 0 1 4.2-0.8" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M3.8 5.2V3.5a2.2 2.2 0 0 1 4.4 0v1.7" stroke="currentColor" strokeWidth="1" fill="none" />
      )}
    </svg>
  );
}
