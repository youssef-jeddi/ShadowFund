import Link from "next/link";
import { SfLogo } from "@/components/shadow-fund/primitives/sf-logo";

export function SfFooter() {
  return (
    <footer
      style={{
        marginTop: 120,
        borderTop: "1px solid var(--border)",
        padding: "48px 32px 40px",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 48,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <Link href="/" style={{ display: "inline-flex" }}>
            <SfLogo size={20} />
          </Link>
          <p
            style={{
              marginTop: 16,
              color: "var(--text-muted)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Confidential vaults for DeFi yield. Strategies are public.
            Individual deposit amounts stay private. Built on iExec Nox.
          </p>
        </div>
        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--text-muted)" }}
        >
          © 2026 SHADOWFUND PROTOCOL
        </div>
      </div>
    </footer>
  );
}
