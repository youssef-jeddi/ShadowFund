import { SfNav } from "@/components/layout/sf-nav";
import { SfFooter } from "@/components/layout/sf-footer";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      <SfNav />
      <main style={{ flex: 1 }}>{children}</main>
      <SfFooter />
    </div>
  );
}
