"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppKitAccount } from "@reown/appkit/react";
import { useDisconnect } from "wagmi";
import { useConnectWallet } from "@/hooks/use-connect-wallet";
import { SfLogo } from "@/components/shadow-fund/primitives/sf-logo";
import { SfTag } from "@/components/shadow-fund/primitives/sf-tag";

const NAV_ITEMS = [
  { id: "home",      label: "Home",      href: "/" },
  { id: "vaults",    label: "Vaults",    href: "/funds" },
  { id: "manager",   label: "Manager",   href: "/dashboard/manager" },
  { id: "portfolio", label: "Portfolio", href: "/dashboard/depositor" },
  { id: "activity",  label: "Activity",  href: "/activity" },
];

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function SfNav() {
  const pathname = usePathname();
  const { address, isConnected } = useAppKitAccount();
  const { connect } = useConnectWallet();
  const { disconnect } = useDisconnect();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "oklch(0.14 0.008 60 / 0.88)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left: logo + nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <Link href="/" style={{ display: "inline-flex" }}>
            <SfLogo size={22} />
          </Link>
          <nav style={{ display: "flex", gap: 2 }}>
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    color: active ? "var(--text)" : "var(--text-muted)",
                    borderBottom: active ? "1px solid var(--pearl)" : "1px solid transparent",
                    borderRadius: 0,
                    transition: "color 150ms",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: network badge + wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="eyebrow mono" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 5, height: 5, background: "var(--green)", borderRadius: 10, animation: "blink 2s infinite" }} />
            iExec Nox
          </div>
          <SfTag tone="encrypted">Nox-Sealed</SfTag>
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />

          {isConnected && address ? (
            <div style={{ position: "relative", display: "inline-flex" }}>
              <WalletDropdown address={address} onDisconnect={disconnect} />
            </div>
          ) : (
            <button
              onClick={connect}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                border: "1px solid var(--pearl)",
                background: "var(--pearl)",
                color: "oklch(0.14 0.008 60)",
                borderRadius: 2,
                fontSize: 12,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function WalletDropdown({ address, onDisconnect }: { address: string; onDisconnect: () => void }) {
  return (
    <button
      onClick={onDisconnect}
      title="Click to disconnect"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        border: "1px solid var(--border-strong)",
        background: "var(--surface)",
        borderRadius: 2,
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 2,
          background: "linear-gradient(135deg, var(--pearl), var(--pearl-deep))",
          flexShrink: 0,
        }}
      />
      <span className="mono">{formatAddress(address)}</span>
    </button>
  );
}
