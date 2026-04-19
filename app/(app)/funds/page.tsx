import type { Metadata } from "next";
import { FundBrowserContent } from "@/components/shadow-fund/fund-browser-content";

export const metadata: Metadata = {
  title: "ShadowFund | Browse Funds",
  description: "Confidential investment funds powered by iExec Nox",
};

export default function FundsPage() {
  return (
    <div style={{ minHeight: "60vh" }}>
      <FundBrowserContent />
    </div>
  );
}
