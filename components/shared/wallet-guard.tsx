"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

export function WalletGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isConnected, isConnecting, isReconnecting, status } = useAccount();

  useEffect(() => {
    if (status === "disconnected") {
      router.replace("/");
    }
  }, [status, router]);

  if (isConnecting || isReconnecting) return null;
  if (!isConnected) return null;

  return <>{children}</>;
}
