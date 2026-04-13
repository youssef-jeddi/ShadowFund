import type { Metadata } from "next";
import { ManagerDashboardContent } from "@/components/shadow-fund/manager-dashboard-content";

export const metadata: Metadata = {
  title: "ShadowFund | Manager Dashboard",
  description: "Create and manage your confidential investment fund",
};

export default function ManagerDashboardPage() {
  return (
    <div className="min-h-[60vh] px-4 py-8 md:px-8 md:py-10">
      <ManagerDashboardContent />
    </div>
  );
}
