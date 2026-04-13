import type { Metadata } from "next";
import { RevealPageContent } from "@/components/shadow-fund/reveal-page-content";

export const metadata: Metadata = {
  title: "ShadowFund | Reveal Strategy",
};

export default async function RevealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-[60vh] px-4 py-8 md:px-8 md:py-10">
      <RevealPageContent fundId={BigInt(id)} />
    </div>
  );
}
