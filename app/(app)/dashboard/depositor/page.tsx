import type { Metadata } from "next";
import { DepositorDashboardContent } from "@/components/shadow-fund/depositor-dashboard-content";

export const metadata: Metadata = {
  title: "ShadowFund | My Positions",
  description: "Your confidential investments across ShadowFund vaults",
};

export default function DepositorDashboardPage() {
  return (
    <div style={{ minHeight: "60vh" }}>
      <DepositorDashboardContent />
    </div>
  );
}
