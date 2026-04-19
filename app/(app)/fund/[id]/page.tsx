import type { Metadata } from "next";
import { FundDetailContent } from "@/components/shadow-fund/fund-detail-content";

export const metadata: Metadata = {
  title: "ShadowFund | Fund Details",
};

export default async function FundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div style={{ minHeight: "60vh" }}>
      <FundDetailContent fundId={BigInt(id)} />
    </div>
  );
}
