export function PortfolioHeader() {
  return (
    <div style={{ padding: "48px 32px 24px", maxWidth: 1400, margin: "0 auto" }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Wallet · Assets</div>
      <h1
        className="display"
        style={{ fontSize: 48, letterSpacing: "-0.025em", lineHeight: 1 }}
      >
        Portfolio
        <span className="display-italic" style={{ color: "var(--pearl)" }}>.</span>
      </h1>
    </div>
  );
}
