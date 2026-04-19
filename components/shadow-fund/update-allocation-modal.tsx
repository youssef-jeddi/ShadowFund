"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  StrategySliders,
  type StrategyAllocation,
} from "@/components/shadow-fund/strategy-sliders";
import { useUpdateAllocation } from "@/hooks/use-update-allocation";

interface UpdateAllocationModalProps {
  fundId: bigint;
  /** Current allocation bps, order [aaveUsdc, fixed]. */
  currentBps: [number, number];
  onClose: () => void;
  onSuccess?: () => void;
}

export function UpdateAllocationModal({
  fundId,
  currentBps,
  onClose,
  onSuccess,
}: UpdateAllocationModalProps) {
  const [allocation, setAllocation] = useState<StrategyAllocation>({
    aaveUsdcBps: currentBps[0],
    fixedBps: currentBps[1],
  });
  const { updateAllocation, step, error, reset } = useUpdateAllocation();

  useEffect(() => () => reset(), [reset]);

  const sumValid = allocation.aaveUsdcBps + allocation.fixedBps === 10_000;
  const unchanged =
    allocation.aaveUsdcBps === currentBps[0] && allocation.fixedBps === currentBps[1];
  const busy = step === "writing";

  const handleSubmit = async () => {
    const ok = await updateAllocation(fundId, [
      allocation.aaveUsdcBps,
      allocation.fixedBps,
    ]);
    if (ok) {
      onSuccess?.();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md rounded-2xl border"
        style={{ background: "var(--sf-card-bg)", borderColor: "var(--sf-card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="px-5 pt-5 pb-0">
          <h2 className="text-base font-semibold text-text-heading">
            Update Fund Allocation
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Affects only future <code className="text-[10px]">deployCapital</code>{" "}
            slices. Already-deployed capital stays where it is until you
            withdraw + redeploy.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-5 py-4">
          <StrategySliders
            value={allocation}
            onChange={setAllocation}
            fundId={fundId}
            disabled={busy}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 text-sm"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 text-sm"
              style={{ background: "var(--sf-violet)", color: "#fff" }}
              disabled={!sumValid || unchanged || busy}
              onClick={handleSubmit}
            >
              {busy ? "Submitting..." : "Update Allocation"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
