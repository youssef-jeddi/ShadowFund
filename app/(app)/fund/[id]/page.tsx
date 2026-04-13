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
    <div className="min-h-[60vh] px-4 py-8 md:px-8 md:py-10">
      <FundDetailContent fundId={BigInt(id)} />
    </div>
  );
}
