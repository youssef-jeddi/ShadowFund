import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | ShadowFund",
  description:
    "Terms of use for the ShadowFund confidential DeFi vault protocol on iExec Nox.",
};

const LAST_UPDATED = "March 7, 2026";

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "64px 32px" }}>
      <h1
        className="display"
        style={{ fontSize: 56, letterSpacing: "-0.025em", lineHeight: 1 }}
      >
        Terms of Use
        <span className="display-italic" style={{ color: "var(--pearl)" }}>.</span>
      </h1>
      <p
        className="mono"
        style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}
      >
        Last updated: {LAST_UPDATED}
      </p>

      <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 32 }}>
        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using the ShadowFund application (the &quot;App&quot;),
            you agree to be bound by these Terms of Use. If you do not agree with
            any part of these terms, you must not use the App.
          </p>
        </Section>

        <Section title="2. Testnet Disclaimer">
          <p>
            The App operates on the <strong>iExec Nox testnet</strong>. All tokens
            displayed, minted, wrapped, or transferred within the App have{" "}
            <strong>no real monetary value</strong>. This is a demonstration and
            testing environment only.
          </p>
        </Section>

        <Section title="3. Confidential Tokens">
          <p>
            The App uses confidential tokens (cUSDC) built on the iExec Nox
            infrastructure. While the protocol is designed to provide on-chain
            confidentiality through encrypted balances,{" "}
            <strong>no guarantee of absolute privacy or confidentiality</strong> is
            made. The technology is experimental.
          </p>
        </Section>

        <Section title="4. Wallet Responsibility">
          <p>
            You are solely responsible for the security and management of your
            wallet, private keys, and seed phrases. The App does not store, access,
            or recover your private keys.
          </p>
        </Section>

        <Section title="5. No Financial Advice">
          <p>
            Nothing in the App constitutes financial, investment, legal, or tax
            advice. The App is provided for educational and demonstration purposes
            only.
          </p>
        </Section>

        <Section title="6. Intellectual Property">
          <p>
            The iExec Nox protocol, its smart contracts, SDK, and this application
            are developed by <strong>iExec Blockchain Tech</strong>. All
            intellectual property rights remain with their respective owners.
          </p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>
            The App is provided &quot;as is&quot; without warranties. iExec
            Blockchain Tech shall not be liable for any losses, damages, or claims
            arising from your use of the App.
          </p>
        </Section>

        <Section title="8. Modifications">
          <p>
            We reserve the right to modify these Terms at any time. Continued use
            of the App after modifications constitutes acceptance of the revised
            terms.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            For questions, contact the iExec team at{" "}
            <a
              href="https://iex.ec"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--pearl)", textDecoration: "none" }}
            >
              iex.ec
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="display"
        style={{ fontSize: 22, letterSpacing: "-0.015em", fontWeight: 500 }}
      >
        {title}
      </h2>
      <div
        style={{
          marginTop: 10,
          color: "var(--text-dim)",
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </section>
  );
}
