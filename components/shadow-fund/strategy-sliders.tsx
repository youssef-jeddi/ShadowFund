"use client";

import { useCallback } from "react";
import { useReadContract } from "wagmi";
import type { StrategyAllocation } from "@/hooks/use-set-strategy";
import { shadowFundVaultAbi } from "@/lib/shadow-fund-abi";
import { CONTRACTS } from "@/lib/contracts";

interface StrategySlidersProps {
  value: StrategyAllocation;
  onChange: (allocation: StrategyAllocation) => void;
  disabled?: boolean;
}

const WETH_COLOR = "#6366f1";
const USDC_COLOR = "#10b981";

const vaultAddress = ("SHADOW_FUND_VAULT" in CONTRACTS)
  ? (CONTRACTS as Record<string, `0x${string}`>).SHADOW_FUND_VAULT
  : undefined;

/**
 * Single slider: WETH basis points (0-10000). USDC = 10000 - wethBps (implicit).
 *
 * Reveal-time "allocation alpha" is scored on wethBps vs 50/50 benchmark. USDC
 * leg is always supplied 100% to Aave v3 regardless of the slider position —
 * the slider reflects the manager's virtual strategy claim, not capital routing.
 */
export function StrategySliders({ value, onChange, disabled }: StrategySlidersProps) {
  const wethBps = value.wethBps;
  const usdcBps = 10_000 - wethBps;

  const { data: apyBpsRaw } = useReadContract({
    address: vaultAddress,
    abi: shadowFundVaultAbi,
    functionName: "getCurrentAaveApyBps",
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 30_000,
    },
  });
  const apyPct =
    typeof apyBpsRaw === "bigint" ? (Number(apyBpsRaw) / 100).toFixed(2) : null;

  const handleChange = useCallback(
    (newVal: number) => {
      onChange({ wethBps: newVal });
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-text-heading">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: WETH_COLOR }}
            />
            WETH
          </label>
          <span
            className="min-w-[3rem] text-right text-sm font-bold"
            style={{ color: WETH_COLOR }}
          >
            {(wethBps / 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10_000}
          step={100}
          value={wethBps}
          disabled={disabled}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full cursor-pointer accent-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ accentColor: WETH_COLOR }}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-heading">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: USDC_COLOR }}
          />
          USDC {apyPct && <span className="text-xs text-emerald-400">earns {apyPct}% on Aave</span>}
        </label>
        <span
          className="min-w-[3rem] text-right text-sm font-bold"
          style={{ color: USDC_COLOR }}
        >
          {(usdcBps / 100).toFixed(0)}%
        </span>
      </div>

      <p className="text-xs text-text-muted">
        WETH / USDC split is your encrypted strategy claim. Depositors always earn
        real USDC yield from Aave — WETH allocation is scored post-reveal against
        a 50/50 benchmark.
      </p>
    </div>
  );
}
