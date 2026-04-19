"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";
import { SfCard } from "@/components/shadow-fund/primitives/sf-card";
import { SfInput } from "@/components/shadow-fund/primitives/sf-input";
import { SfTag } from "@/components/shadow-fund/primitives/sf-tag";
import { StatCell } from "@/components/shadow-fund/primitives/stat-cell";
import { Scramble } from "@/components/shadow-fund/primitives/scramble";
import { LockIcon } from "@/components/shadow-fund/primitives/lock-icon";
import { Ticker } from "@/components/shadow-fund/primitives/ticker";
import { useFundList } from "@/hooks/use-fund-list";
import { useMyPosition } from "@/hooks/use-my-position";
import { useRequestDeposit } from "@/hooks/use-request-deposit";
import { useRequestRedeem } from "@/hooks/use-request-redeem";
import { useClaimRedemption } from "@/hooks/use-claim-redemption";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { useConfidentialBalances } from "@/hooks/use-confidential-balances";
import { useDecryptBalance } from "@/hooks/use-decrypt-balance";
import { useSubVaultMetrics } from "@/hooks/use-subvault-metrics";
import { useWrapModal } from "@/components/modals/wrap-modal-provider";
import { truncateAddress } from "@/lib/utils";
import type { FundMetadata } from "@/hooks/use-fund-list";

export function DepositorDashboardContent() {
  const { address } = useAccount();
  const { funds, isLoading } = useFundList();

  if (!address) {
    return (
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "80px 32px",
          textAlign: "center",
          color: "var(--text-muted)",
        }}
      >
        Connect your wallet to view your positions.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "56px 32px" }}>
      {/* Header */}
      <Eyebrow dot>Your positions · only visible to you</Eyebrow>
      <h1
        className="display"
        style={{ fontSize: 64, marginTop: 14, letterSpacing: "-0.028em" }}
      >
        Portfolio
        <span className="display-italic" style={{ color: "var(--pearl)" }}>
          .
        </span>
      </h1>

      {/* Wallet balances */}
      <div style={{ marginTop: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <Eyebrow>Wallet balances</Eyebrow>
            <h2
              className="display"
              style={{ fontSize: 32, marginTop: 6, letterSpacing: "-0.02em" }}
            >
              Two tokens
              <span className="display-italic" style={{ color: "var(--pearl)" }}>
                ,
              </span>{" "}
              two visibilities
            </h2>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {truncateAddress(address)}
          </div>
        </div>
        <WalletBalancesSplit />
      </div>

      {/* Positions */}
      <div style={{ marginTop: 56 }}>
        <Eyebrow>§ Vault positions</Eyebrow>
        <h2 className="display" style={{ fontSize: 32, marginTop: 8, marginBottom: 24, letterSpacing: "-0.02em" }}>
          Active vaults
        </h2>

        {isLoading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading vaults…</div>
        ) : funds.length === 0 ? (
          <div
            style={{
              padding: "64px 32px",
              textAlign: "center",
              border: "1px dashed var(--border)",
            }}
          >
            <div style={{ color: "var(--text-muted)", marginBottom: 24 }}>
              No vaults available yet.
            </div>
            <Link href="/funds">
              <SfButton variant="primary">Browse Vaults</SfButton>
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              background: "var(--border)",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 160px",
                background: "var(--bg-2)",
                padding: "14px 20px",
              }}
            >
              {["Vault", "Shares", "Deposited", "APY", "Status", ""].map((c) => (
                <div key={c} className="eyebrow">
                  {c}
                </div>
              ))}
            </div>
            {funds.map((fund) => (
              <DepositorPositionRow key={fund.fundId.toString()} fund={fund} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WalletBalancesSplit() {
  const { balances: tokenBalances, isLoading: tokenLoading } = useTokenBalances();
  const { balances: confBalances } = useConfidentialBalances();
  const { decryptingSymbol, decrypt, getConfidentialDisplay } = useDecryptBalance();
  const { setOpen: openWrap } = useWrapModal();

  const usdcBalance = tokenBalances.find((b) => b.symbol === "USDC");
  const cUsdcBalance = confBalances.find((b) => b.symbol === "cUSDC");
  const cUsdcDisplay = getConfidentialDisplay("cUSDC");
  const cUsdcResolved = cUsdcDisplay !== null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 1,
        background: "var(--border)",
      }}
    >
      {/* USDC */}
      <div
        style={{
          background: "var(--surface)",
          padding: "32px 32px 28px",
          display: "flex",
          flexDirection: "column",
          minHeight: 240,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "oklch(0.58 0.15 250)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                flexShrink: 0,
              }}
            >
              $
            </div>
            <div>
              <div style={{ fontSize: 15 }}>USDC</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em", marginTop: 2 }}>
                USD COIN · PUBLIC
              </div>
            </div>
          </div>
          <SfTag tone="neutral">Visible on-chain</SfTag>
        </div>

        <div style={{ marginTop: 28, flex: 1 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Balance</div>
          <div
            className="mono tabular"
            style={{ fontSize: 44, letterSpacing: "-0.02em" }}
          >
            {tokenLoading ? "—" : (usdcBalance?.formatted ?? "0.00")}
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
            USD Coin · ERC-20
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 10,
          }}
        >
          <SfButton
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onClick={() => openWrap(true)}
          >
            Wrap to cUSDC
          </SfButton>
        </div>
      </div>

      {/* cUSDC */}
      <div
        style={{
          background: "var(--surface)",
          padding: "32px 32px 28px",
          display: "flex",
          flexDirection: "column",
          minHeight: 240,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Pearl corner accents */}
        <span style={{ position: "absolute", top: 0, right: 0, width: 2, height: 40, background: "var(--pearl)" }} />
        <span style={{ position: "absolute", top: 0, right: 0, width: 40, height: 2, background: "var(--pearl)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "linear-gradient(135deg, var(--pearl), var(--pearl-deep))",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                color: "oklch(0.14 0.008 60)",
              }}
            >
              <LockIcon size={14} open={cUsdcResolved} />
            </div>
            <div>
              <div style={{ fontSize: 15 }}>cUSDC</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--pearl)", letterSpacing: "0.06em", marginTop: 2 }}>
                CONFIDENTIAL · IEXEC NOX
              </div>
            </div>
          </div>
          <SfTag tone={cUsdcResolved ? "green" : "encrypted"}>
            {cUsdcResolved ? "Decrypted" : "Sealed"}
          </SfTag>
        </div>

        <div style={{ marginTop: 28, flex: 1 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Balance</div>
          <div
            className="mono tabular"
            style={{ fontSize: 44, letterSpacing: "-0.02em", color: cUsdcResolved ? "var(--text)" : "var(--pearl)" }}
          >
            <Scramble
              value={cUsdcDisplay ?? "0"}
              length={7}
              resolved={cUsdcResolved}
            />
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
            {cUsdcResolved ? "cUSDC · decrypted" : "Only you can decrypt this value"}
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          {cUsdcResolved ? (
            <>
              <Link href="/funds" style={{ flex: 1 }}>
                <SfButton variant="secondary" size="sm" style={{ width: "100%" }}>
                  Deposit into vault
                </SfButton>
              </Link>
            </>
          ) : (
            <SfButton
              variant="primary"
              size="sm"
              style={{ flex: 1 }}
              disabled={decryptingSymbol === "cUSDC"}
              onClick={() => decrypt("cUSDC")}
            >
              {decryptingSymbol === "cUSDC" ? "Decrypting…" : "Sign to reveal"}
            </SfButton>
          )}
        </div>
      </div>
    </div>
  );
}

function DepositorPositionRow({ fund }: { fund: FundMetadata }) {
  const { position, decrypting, decryptBalance, decryptError } = useMyPosition(fund.fundId);
  const depositHook = useRequestDeposit();
  const redeemHook = useRequestRedeem();
  const claimHook = useClaimRedemption();
  const { metrics } = useSubVaultMetrics(fund.fundId);

  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");

  const [aaveBps, fixedBps] = fund.allocationBps;
  const blendedApyBps = (aaveBps * metrics.apys[0] + fixedBps * metrics.apys[1]) / 10_000;
  const blendedApyPct = blendedApyBps / 100;

  const balanceResolved = !decrypting && position.decryptedBalance !== null;

  return (
    <>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 160px",
          alignItems: "center",
          padding: "20px 20px",
          background: hover ? "var(--surface-2)" : "var(--surface)",
          cursor: "pointer",
          position: "relative",
          transition: "background 150ms",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {hover && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 2,
              background: "var(--pearl)",
            }}
          />
        )}
        {/* Vault */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 2,
              background: "linear-gradient(135deg, var(--pearl), var(--pearl-deep))",
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{fund.name}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              {truncateAddress(fund.manager)}
            </div>
          </div>
        </div>
        {/* Shares */}
        <div className="mono tabular" style={{ fontSize: 13 }}>
          <Scramble
            value={position.decryptedBalance?.toString() ?? "0"}
            length={6}
            resolved={balanceResolved}
          />
        </div>
        {/* Deposited */}
        <div className="mono tabular" style={{ fontSize: 13, color: "var(--text-dim)" }}>
          —
        </div>
        {/* APY */}
        <div className="mono tabular" style={{ fontSize: 13, color: "var(--green)" }}>
          {blendedApyPct > 0 ? (
            <Ticker
              value={blendedApyPct}
              format={(v) => v.toFixed(2) + "%"}
              interval={1200}
              jitter={0.0003}
            />
          ) : (
            "—"
          )}
        </div>
        {/* Status */}
        <div>
          {position.isClaimable ? (
            <SfTag tone="green">Claimable</SfTag>
          ) : position.hasPendingRedeem ? (
            <SfTag tone="accent">Redeem Pending</SfTag>
          ) : (
            <SfTag tone="neutral">Active</SfTag>
          )}
        </div>
        {/* Action */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              decryptBalance();
            }}
            disabled={decrypting || balanceResolved}
            style={{
              fontSize: 11,
              color: balanceResolved ? "var(--green)" : "var(--pearl)",
              background: "none",
              cursor: balanceResolved || decrypting ? "default" : "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase" as const,
              padding: "4px 8px",
              borderRadius: 2,
              border: "1px solid " + (balanceResolved ? "var(--green)" : "var(--pearl)"),
              transition: "opacity 150ms",
            }}
          >
            {decrypting ? "…" : balanceResolved ? "Decrypted" : "Decrypt"}
          </button>
          <Link
            href={`/fund/${fund.fundId}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none" }}
          >
            View →
          </Link>
        </div>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div
          style={{
            background: "var(--bg-2)",
            padding: "20px 20px 20px 80px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {decryptError && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "var(--red)" }}>{decryptError}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            {/* Deposit */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Deposit</div>
              <div style={{ display: "flex", gap: 8 }}>
                <SfInput
                  type="number"
                  placeholder="Amount (cUSDC)"
                  mono
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  style={{ flex: 1 }}
                />
                <SfButton
                  variant="primary"
                  size="sm"
                  disabled={!depositAmount || depositHook.step !== "idle"}
                  onClick={async () => {
                    const ok = await depositHook.requestDeposit(fund.fundId, depositAmount);
                    if (ok) setDepositAmount("");
                  }}
                >
                  {depositHook.step === "idle" || depositHook.step === "confirmed" || depositHook.step === "error"
                    ? "Deposit"
                    : depositHook.step === "encrypting"
                    ? "Encrypting…"
                    : "Depositing…"}
                </SfButton>
              </div>
              {depositHook.error && (
                <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6 }}>{depositHook.error}</div>
              )}
              {depositHook.step === "confirmed" && (
                <div style={{ fontSize: 11, color: "var(--green)", marginTop: 6 }}>Deposited.</div>
              )}
            </div>

            {/* Redeem */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Redeem</div>
              <div style={{ display: "flex", gap: 8 }}>
                <SfInput
                  type="number"
                  placeholder="Shares"
                  mono
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  style={{ flex: 1 }}
                />
                <SfButton
                  variant="secondary"
                  size="sm"
                  disabled={!redeemAmount || redeemHook.step !== "idle"}
                  onClick={async () => {
                    const ok = await redeemHook.requestRedeem(fund.fundId, redeemAmount);
                    if (ok) setRedeemAmount("");
                  }}
                >
                  {redeemHook.step === "idle" || redeemHook.step === "confirmed" || redeemHook.step === "error"
                    ? "Redeem"
                    : redeemHook.step === "encrypting"
                    ? "Encrypting…"
                    : "Submitting…"}
                </SfButton>
              </div>
              {redeemHook.error && (
                <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6 }}>{redeemHook.error}</div>
              )}
            </div>

            {/* Claim */}
            {position.isClaimable && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Claim</div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                  Redemption processed. Click to receive cUSDC.
                </p>
                <SfButton
                  variant="primary"
                  size="sm"
                  disabled={claimHook.step !== "idle"}
                  onClick={() => claimHook.claimRedemption(fund.fundId)}
                >
                  {claimHook.step === "idle" || claimHook.step === "confirmed" || claimHook.step === "error"
                    ? "Claim cUSDC"
                    : "Claiming…"}
                </SfButton>
                {claimHook.error && (
                  <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6 }}>{claimHook.error}</div>
                )}
                {claimHook.step === "confirmed" && (
                  <div style={{ fontSize: 11, color: "var(--green)", marginTop: 6 }}>Claimed.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
