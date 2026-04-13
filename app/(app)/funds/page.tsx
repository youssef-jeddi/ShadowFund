import type { Metadata } from "next";
import { FundBrowserContent } from "@/components/shadow-fund/fund-browser-content";

export const metadata: Metadata = {
  title: "ShadowFund | Browse Funds",
  description: "Confidential investment funds powered by iExec Nox",
};

export default function FundsPage() {
  return (
    <div className="min-h-[60vh] px-4 py-8 md:px-8 md:py-10">
      <FundBrowserContent />
    </div>
  );
}
