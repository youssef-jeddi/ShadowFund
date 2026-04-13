import type { Metadata } from "next";
import { DepositorDashboardContent } from "@/components/shadow-fund/depositor-dashboard-content";

export const metadata: Metadata = {
  title: "ShadowFund | My Positions",
  description: "Your confidential investments across ShadowFund vaults",
};

export default function DepositorDashboardPage() {
  return (
    <div className="min-h-[60vh] px-4 py-8 md:px-8 md:py-10">
      <DepositorDashboardContent />
    </div>
  );
}
