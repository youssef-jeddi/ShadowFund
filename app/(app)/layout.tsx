import { SfNav } from "@/components/layout/sf-nav";
import { SfFooter } from "@/components/layout/sf-footer";
import { WalletGuard } from "@/components/shared/wallet-guard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletGuard>
      <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
        <SfNav />
        <main style={{ flex: 1 }}>{children}</main>
        <SfFooter />
      </div>
    </WalletGuard>
  );
}
