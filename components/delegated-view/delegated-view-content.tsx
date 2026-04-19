"use client";

import { useMemo, useState } from "react";
import { DelegatedViewTable } from "./delegated-view-table";
import { useDelegatedView } from "@/hooks/use-delegated-view";
import { useDecryptHandle } from "@/hooks/use-decrypt-handle";
import { useDevMode } from "@/hooks/use-dev-mode";
import { CodeSection } from "@/components/shared/code-section";
import { InfoCard } from "@/components/shared/info-card";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import {
  DELEGATED_VIEW_TABS,
  exportToCsv,
  type DelegatedViewTab,
} from "@/lib/delegated-view";

const ITEMS_PER_PAGE = 10;

const DEV_CODE_SHARED = `// Fetch ViewerAdded events where I am the viewer
const logs = await publicClient.getContractEvents({
  address: NOX_COMPUTE_ADDRESS,
  abi: noxComputeAbi,
  eventName: "ViewerAdded",
  args: { viewer: myAddress },
  fromBlock: 0n,
});`;

const DEV_CODE_GRANTS = `// Fetch ViewerAdded events where I am the sender
const logs = await publicClient.getContractEvents({
  address: NOX_COMPUTE_ADDRESS,
  abi: noxComputeAbi,
  eventName: "ViewerAdded",
  args: { sender: myAddress },
  fromBlock: 0n,
});`;

export function DelegatedViewContent() {
  const { sharedWithMe, myGrants, isLoading, error } = useDelegatedView();
  const { decryptedValues, decryptingHandle, decrypt } = useDecryptHandle();
  const { enabled: devMode } = useDevMode();
  const [activeTab, setActiveTab] = useState<DelegatedViewTab>("shared");
  const [page, setPage] = useState(1);

  const entries = activeTab === "shared" ? sharedWithMe : myGrants;
  const totalPages = Math.max(1, Math.ceil(entries.length / ITEMS_PER_PAGE));
  const paginated = useMemo(
    () => entries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [entries, page],
  );

  function handleTabChange(tab: DelegatedViewTab) {
    setActiveTab(tab);
    setPage(1);
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "56px 32px" }}>
      {/* Header */}
      <Eyebrow>iExec Nox · ACL delegations</Eyebrow>
      <h1
        className="display"
        style={{ fontSize: 64, marginTop: 14, letterSpacing: "-0.028em", lineHeight: 1 }}
      >
        Delegated
        <span className="display-italic" style={{ color: "var(--pearl)" }}> view</span>
        .
      </h1>
      <p style={{ color: "var(--text-dim)", marginTop: 10, fontSize: 15, marginBottom: 40 }}>
        View and manage ACL delegations for your confidential token handles.
      </p>

      {/* Tabs + Export */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
          paddingBottom: 20,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {DELEGATED_VIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                border: "1px solid " + (activeTab === tab.value ? "var(--pearl)" : "var(--border)"),
                color: activeTab === tab.value ? "var(--pearl)" : "var(--text-dim)",
                background: activeTab === tab.value ? "oklch(0.92 0.02 90 / 0.05)" : "transparent",
                borderRadius: 2,
                cursor: "pointer",
                transition: "all 150ms",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => exportToCsv(entries, activeTab, decryptedValues)}
          disabled={entries.length === 0}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            background: "transparent",
            borderRadius: 2,
            cursor: entries.length === 0 ? "not-allowed" : "pointer",
            opacity: entries.length === 0 ? 0.4 : 1,
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "48px 0" }}>
          Loading delegations…
        </div>
      ) : error ? (
        <div
          style={{
            padding: "48px 32px",
            textAlign: "center",
            border: "1px solid var(--red)",
            background: "oklch(0.68 0.18 25 / 0.05)",
          }}
        >
          <div style={{ color: "var(--red)", fontSize: 14 }}>Failed to load delegated view</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>{error}</div>
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            padding: "64px 32px",
            textAlign: "center",
            border: "1px dashed var(--border)",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {activeTab === "shared"
              ? "No one has shared handle access with you yet."
              : "You haven't granted viewer access to anyone yet."}
          </div>
        </div>
      ) : (
        <>
          <DelegatedViewTable
            entries={paginated}
            tab={activeTab}
            decryptedValues={decryptedValues}
            decryptingHandle={decryptingHandle}
            onDecrypt={decrypt}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 24,
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Showing {paginated.length} of {entries.length} entries
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  color: page <= 1 ? "var(--text-muted)" : "var(--text)",
                  padding: "4px 10px",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  fontSize: 12,
                  borderRadius: 2,
                  opacity: page <= 1 ? 0.4 : 1,
                }}
              >
                ←
              </button>
              <span
                className="mono"
                style={{
                  padding: "4px 12px",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  borderRadius: 2,
                  background: "var(--surface)",
                }}
              >
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  color: page >= totalPages ? "var(--text-muted)" : "var(--text)",
                  padding: "4px 10px",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  fontSize: 12,
                  borderRadius: 2,
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >
                →
              </button>
            </div>
          </div>
        </>
      )}

      {devMode && (
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
          <InfoCard>
            The Delegated View reads <code className="font-mono text-xs">ViewerAdded</code> events
            from the NoxCompute contract, then resolves each handle to a token
            via <code className="font-mono text-xs">confidentialBalanceOf</code>.
          </InfoCard>
          <CodeSection
            code={activeTab === "shared" ? DEV_CODE_SHARED : DEV_CODE_GRANTS}
            language="typescript"
          />
        </div>
      )}
    </div>
  );
}
