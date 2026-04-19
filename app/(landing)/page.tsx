import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";

export const metadata: Metadata = {
  title: "ShadowFund — Confidential DeFi Vaults",
  description:
    "Confidential vault protocol. Managers publish strategies. Depositors allocate privately with cUSDC. Individual balances stay encrypted on-chain via iExec Nox.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
    </>
  );
}
