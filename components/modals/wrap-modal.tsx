"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWrapModal } from "./wrap-modal-provider";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useWrap } from "@/hooks/use-wrap";
import { useUnwrap } from "@/hooks/use-unwrap";
import { wrappableTokens as wrappableTokenConfigs } from "@/lib/tokens";
import { TxSuccessStatus } from "@/components/shared/tx-success-status";
import { useEstimatedFee } from "@/hooks/use-estimated-fee";
import { useDecryptBalance } from "@/hooks/use-decrypt-balance";
import { useDropdown } from "@/hooks/use-dropdown";
import { ProgressTracker, type ProgressStep } from "@/components/shared/step-indicator";
import { CodeSection } from "@/components/shared/code-section";
import { InfoCard } from "@/components/shared/info-card";
import { ErrorMessage } from "@/components/shared/error-message";
import { EncryptedBalance } from "@/components/shared/encrypted-balance";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";

const WRAP_CODE = `function wrap(address to, uint256 amount) public virtual override returns (euint256) {
    // take ownership of the underlying tokens
    SafeERC20.safeTransferFrom(IERC20(underlying()), msg.sender, address(this), amount - (amount % rate()));

    // mint confidential tokens to recipient
    euint256 wrappedAmountSent = _mint(to, Nox.toEuint256(amount / rate()));
    Nox.allowTransient(wrappedAmountSent, msg.sender);
    return wrappedAmountSent;
}`;

const UNWRAP_CODE = `// Step 1: Initiate unwrap with encrypted amount
function unwrap(
    address from, address to,
    bytes32 encryptedAmount, bytes inputProof
) external;

// Step 2: Finalize unwrap — contract decrypts the amount on-chain
function finalizeUnwrap(
    euint256 unwrapAmount,
    bytes decryptionProof
) external;`;

const WRAP_STEPS: ProgressStep[] = [
  { key: "approving", icon: "check_circle", label: "Approve" },
  { key: "wrapping", icon: "sync", label: "Wrap" },
  { key: "confirmed", icon: "verified", label: "Confirmed" },
];

const UNWRAP_STEPS: ProgressStep[] = [
  { key: "encrypting", icon: "lock", label: "Encrypt" },
  { key: "unwrapping", icon: "sync", label: "Unwrap" },
  { key: "finalizing", icon: "check_circle", label: "Finalize" },
  { key: "confirmed", icon: "verified", label: "Confirmed" },
];

export function WrapModal() {
  const { open, setOpen, activeTab, setActiveTab } = useWrapModal();
  const { balances } = useTokenBalances();
  const { enabled: devMode } = useDevMode();
  const { step: wrapStep, error: wrapError, wrapTxHash, wrap, reset: resetWrap } = useWrap();
  const { step: unwrapStep, error: unwrapError, isFinalizeError, finalizeTxHash, unwrap, retryFinalize, reset: resetUnwrap } = useUnwrap();
  const { decryptedAmounts, decryptingSymbol, decrypt: handleDecryptBalance, getConfidentialDisplay } = useDecryptBalance();
  const { open: dropdownOpen, setOpen: setDropdownOpen, triggerRef, contentRef: dropdownRef } = useDropdown();
  const [selectedSymbol, setSelectedSymbol] = useState("RLC");
  const cSelectedSymbol = `c${selectedSymbol}`;
  const [amount, setAmount] = useState("");
  const isWrap = activeTab === "wrap";
  const { fee: estimatedFee } = useEstimatedFee(isWrap ? 150_000n : 300_000n);
  const isWrapProcessing = wrapStep === "approving" || wrapStep === "wrapping";
  const isUnwrapProcessing = unwrapStep === "encrypting" || unwrapStep === "unwrapping" || unwrapStep === "finalizing";
  const isProcessing = isWrap ? isWrapProcessing : isUnwrapProcessing;
  const currentError = isWrap ? wrapError : unwrapError;

  const wrappableTokens = useMemo(() => wrappableTokenConfigs.map((t) => {
    const bal = balances.find((b) => b.symbol === t.symbol);
    return {
      symbol: t.symbol,
      icon: t.icon,
      decimals: t.decimals,
      balance: bal?.balance ?? 0n,
      formatted: bal?.formatted ?? "0",
    };
  }), [balances]);

  const selectedToken = wrappableTokens.find((t) => t.symbol === selectedSymbol) ?? wrappableTokens[0];

  useEffect(() => {
    if (open) {
      setAmount("");
      setDropdownOpen(false);
      resetWrap();
      resetUnwrap();
    }
  }, [open, activeTab, resetWrap, resetUnwrap, setDropdownOpen]);

  const handleAmountChange = useCallback((value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) setAmount(value);
  }, []);

  const handleMax = useCallback(() => {
    if (isWrap) {
      if (selectedToken) setAmount(selectedToken.formatted);
    } else {
      const decrypted = decryptedAmounts[cSelectedSymbol];
      if (decrypted) setAmount(decrypted);
    }
  }, [isWrap, selectedToken, decryptedAmounts, cSelectedSymbol]);

  const handleSelectToken = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setAmount("");
    setDropdownOpen(false);
  }, [setDropdownOpen]);

  const selectedTokenConfig = wrappableTokenConfigs.find((t) => t.symbol === selectedSymbol);

  const handleWrap = useCallback(async () => {
    if (!selectedTokenConfig || !amount) return;
    const success = await wrap(selectedTokenConfig, amount);
    if (success) setAmount("");
  }, [selectedTokenConfig, amount, wrap]);

  const handleUnwrap = useCallback(async () => {
    if (!selectedTokenConfig || !amount) return;
    const success = await unwrap(selectedTokenConfig, amount);
    if (success) setAmount("");
  }, [selectedTokenConfig, amount, unwrap]);

  const parsedAmount = parseFloat(amount) || 0;
  const hasDecryptedBalance = !isWrap && decryptedAmounts[cSelectedSymbol] !== undefined;
  const maxAmountStr = isWrap ? (selectedToken?.formatted ?? "0") : (decryptedAmounts[cSelectedSymbol] ?? "0");
  const maxAmount = parseFloat(maxAmountStr) || 0;
  const isOverBalance = (isWrap || hasDecryptedBalance) && parsedAmount > maxAmount;
  const needsDecrypt = !isWrap && !hasDecryptedBalance && parsedAmount > 0;
  const isValidAmount = parsedAmount > 0 && !isOverBalance && !needsDecrypt;

  const cTokenSymbol = `c${selectedToken?.symbol ?? "USDC"}`;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value && isProcessing) return; setOpen(value); }}>
      <DialogContent
        showCloseButton={false}
        className="block border-0 bg-transparent p-0 shadow-none rounded-none sm:max-w-[600px] overflow-hidden"
        onEscapeKeyDown={(e) => { if (isProcessing) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isProcessing) e.preventDefault(); }}
      >
        <div
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--border)",
            position: "relative",
            maxHeight: "92vh",
            overflowY: "auto",
          }}
        >
          {/* Pearl corner accents */}
          <span style={{ position: "absolute", top: 0, left: 0, width: 3, height: 36, background: "var(--pearl)" }} />
          <span style={{ position: "absolute", top: 0, left: 0, width: 36, height: 3, background: "var(--pearl)" }} />
          <span style={{ position: "absolute", top: 0, right: 0, width: 3, height: 36, background: "var(--pearl)" }} />
          <span style={{ position: "absolute", top: 0, right: 0, width: 36, height: 3, background: "var(--pearl)" }} />

          <div style={{ padding: "40px 32px 32px" }}>
            {/* Header */}
            <div style={{ textAlign: "center", position: "relative", marginBottom: 28 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isProcessing}
                style={{
                  position: "absolute", top: 0, right: 0,
                  background: "none", border: "none",
                  color: "var(--text-muted)",
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  fontSize: 22, lineHeight: 1, padding: 2,
                  opacity: isProcessing ? 0.3 : 0.7,
                }}
                aria-label="Close"
              >
                ×
              </button>
              <DialogTitle asChild>
                <h2 className="display" style={{ fontSize: 40, letterSpacing: "-0.025em" }}>
                  {isWrap ? "Wrap" : "Unwrap"}
                  <span className="display-italic" style={{ color: "var(--pearl)" }}>.</span>
                </h2>
              </DialogTitle>
              <DialogDescription asChild>
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
                  {isWrap ? "Make your assets confidential" : "Return your assets to public"}
                </p>
              </DialogDescription>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 1, background: "var(--border)", marginBottom: 28 }}>
              {(["wrap", "unwrap"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  disabled={isProcessing}
                  style={{
                    flex: 1, padding: "11px 0",
                    fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                    background: activeTab === tab ? "var(--surface)" : "var(--bg-2)",
                    color: activeTab === tab ? "var(--text)" : "var(--text-muted)",
                    border: "none",
                    borderBottom: activeTab === tab ? "1px solid var(--pearl)" : "1px solid transparent",
                    cursor: isProcessing ? "not-allowed" : "pointer",
                    transition: "all 150ms",
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Balance label */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span className="eyebrow">{isWrap ? "Amount to Wrap" : "Amount to Unwrap"}</span>
              <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", gap: 6, alignItems: "center" }}>
                <span>{isWrap ? "Balance:" : "Confidential:"}</span>
                {isWrap ? (
                  <span className="mono" style={{ color: "var(--text)", fontSize: 12 }}>
                    {selectedToken ? `${selectedToken.formatted} ${selectedToken.symbol}` : "0"}
                  </span>
                ) : (
                  <EncryptedBalance
                    symbol={cSelectedSymbol}
                    display={getConfidentialDisplay(cSelectedSymbol)}
                    decryptingSymbol={decryptingSymbol}
                    onDecrypt={handleDecryptBalance}
                  />
                )}
              </div>
            </div>

            {/* Input area */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                {/* Token selector */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-label="Select token"
                    aria-expanded={dropdownOpen}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-2)",
                      cursor: "pointer",
                      borderRadius: 2,
                    }}
                  >
                    {selectedToken && (
                      <Image src={selectedToken.icon} alt="" width={18} height={18} />
                    )}
                    <span className="mono" style={{ fontSize: 13 }}>
                      {isWrap ? selectedToken?.symbol : cTokenSymbol}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>▾</span>
                  </button>

                  {dropdownOpen && (
                    <div
                      ref={dropdownRef}
                      role="listbox"
                      style={{
                        position: "absolute", top: "100%", left: 0, zIndex: 50,
                        marginTop: 4, padding: 4,
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        minWidth: isWrap ? 140 : 200,
                      }}
                    >
                      {wrappableTokens.map((token) => {
                        const cSymbol = `c${token.symbol}`;
                        const confidentialDisplay = getConfidentialDisplay(cSymbol);
                        return (
                          <button
                            key={token.symbol}
                            type="button"
                            onClick={() => handleSelectToken(token.symbol)}
                            style={{
                              display: "flex", width: "100%", alignItems: "center", gap: 10,
                              padding: "8px 10px",
                              background: token.symbol === selectedSymbol ? "var(--surface)" : "transparent",
                              border: "none", cursor: "pointer",
                              borderRadius: 2,
                            }}
                          >
                            <Image src={token.icon} alt="" width={18} height={18} />
                            <span className="mono" style={{ fontSize: 13, color: "var(--text)" }}>
                              {isWrap ? token.symbol : cSymbol}
                            </span>
                            {isWrap ? (
                              <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                                {token.formatted}
                              </span>
                            ) : (
                              <span style={{ marginLeft: "auto" }}>
                                <EncryptedBalance
                                  symbol={cSymbol}
                                  display={confidentialDisplay}
                                  decryptingSymbol={decryptingSymbol}
                                  onDecrypt={handleDecryptBalance}
                                  showSymbol={false}
                                  iconSize="text-[14px]!"
                                />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Amount input */}
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  style={{
                    flex: 1, minWidth: 0,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    textAlign: "right",
                    fontFamily: "var(--font-mono)",
                    fontSize: 28,
                    color: isOverBalance ? "var(--red)" : "var(--text)",
                  }}
                  aria-label="Amount"
                  aria-invalid={isOverBalance || needsDecrypt}
                />
              </div>

              {isOverBalance && (
                <p style={{ marginTop: 8, fontSize: 11, color: "var(--red)" }}>Insufficient balance</p>
              )}
              {needsDecrypt && (
                <p style={{ marginTop: 8, fontSize: 11, color: "var(--pearl-dim)" }}>Decrypt your balance first to continue</p>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Arbitrum Sepolia</span>
                <button
                  type="button"
                  onClick={handleMax}
                  style={{
                    fontSize: 11, color: "var(--pearl)", background: "none", border: "none",
                    cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
                  }}
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Transaction details */}
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>You will receive</span>
                <span className="mono" style={{ fontSize: 13 }}>
                  {isWrap ? `1:1 ${cTokenSymbol}` : `1:1 ${selectedToken?.symbol}`}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Estimated Gas Fee</span>
                <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>~{estimatedFee ?? "…"} ETH</span>
              </div>
            </div>

            {/* Error */}
            {currentError && !isFinalizeError && (
              <div style={{ marginTop: 16 }}>
                <ErrorMessage error={currentError} onRetry={isWrap ? resetWrap : resetUnwrap} />
              </div>
            )}
            {currentError && isFinalizeError && (
              <div
                style={{
                  marginTop: 16, padding: "14px 16px",
                  border: "1px solid var(--red)",
                  background: "oklch(0.68 0.18 25 / 0.08)",
                  display: "flex", gap: 12, alignItems: "start",
                }}
              >
                <span style={{ fontSize: 16, color: "var(--red)", flexShrink: 0 }}>⚠</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: "var(--red)", lineHeight: 1.6 }}>
                    Tokens unwrapped but finalization failed. Your tokens are in transit — click below to recover them.
                  </p>
                  <button
                    type="button"
                    onClick={retryFinalize}
                    style={{
                      marginTop: 10, padding: "6px 14px",
                      background: "var(--red)", color: "#fff",
                      border: "none", cursor: "pointer",
                      fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
                    }}
                  >
                    Retry Finalize
                  </button>
                </div>
              </div>
            )}

            {/* CTA */}
            <div style={{ marginTop: 24 }}>
              <SfButton
                variant="primary"
                disabled={!isValidAmount || isProcessing}
                onClick={isWrap ? handleWrap : handleUnwrap}
                style={{ width: "100%" }}
              >
                {isProcessing
                  ? isWrap
                    ? wrapStep === "approving" ? "Approving…" : "Wrapping…"
                    : unwrapStep === "encrypting" ? "Encrypting…" : unwrapStep === "unwrapping" ? "Unwrapping…" : "Finalizing…"
                  : isWrap ? "Wrap Assets" : "Unwrap Assets"}
              </SfButton>
            </div>

            {/* Progress tracker */}
            <div style={{ marginTop: 20 }}>
              <ProgressTracker
                currentStep={isWrap ? wrapStep : unwrapStep}
                steps={isWrap ? WRAP_STEPS : UNWRAP_STEPS}
              />
            </div>

            {/* Success */}
            {isWrap && wrapStep === "confirmed" && wrapTxHash && (
              <div style={{ marginTop: 12 }}>
                <TxSuccessStatus message="Wrap Complete" txHash={wrapTxHash} />
              </div>
            )}
            {!isWrap && unwrapStep === "confirmed" && finalizeTxHash && (
              <div style={{ marginTop: 12 }}>
                <TxSuccessStatus message="Unwrap Complete" txHash={finalizeTxHash} />
              </div>
            )}

            {/* How it works */}
            <div style={{ marginTop: 16 }}>
              <InfoCard>
                {isWrap
                  ? "Wrapping moves your tokens from the public Arbitrum ledger into Confidential Token's private vault. Once wrapped, your balance and transfers are only visible to you."
                  : "Unwrapping moves your confidential tokens back to the public Arbitrum ledger. Once unwrapped, your balance and transfers are visible on-chain."}
              </InfoCard>
            </div>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isProcessing}
              style={{
                width: "100%", marginTop: 16,
                background: "none", border: "none",
                color: "var(--text-muted)",
                cursor: isProcessing ? "not-allowed" : "pointer",
                fontSize: 13, opacity: isProcessing ? 0.3 : 0.6,
              }}
            >
              Cancel
            </button>
          </div>
        </div>

        {devMode && (
          <div style={{ marginTop: 16, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            <CodeSection code={isWrap ? WRAP_CODE : UNWRAP_CODE} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
