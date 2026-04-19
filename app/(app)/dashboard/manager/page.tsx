import type { Metadata } from "next";
import { ManagerDashboardContent } from "@/components/shadow-fund/manager-dashboard-content";

export const metadata: Metadata = {
  title: "ShadowFund | Manager Dashboard",
  description: "Create and manage your confidential investment fund",
};

export default function ManagerDashboardPage() {
  return (
    <div style={{ minHeight: "60vh" }}>
      <ManagerDashboardContent />
    </div>
  );
}
