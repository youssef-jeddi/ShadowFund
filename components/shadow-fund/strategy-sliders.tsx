"use client";

import { useCallback, useMemo } from "react";
import { useSubVaultMetrics } from "@/hooks/use-subvault-metrics";

export interface StrategyAllocation {
  aaveUsdcBps: number;
  fixedBps: number;
}

interface StrategySlidersProps {
  value: StrategyAllocation;
  onChange: (allocation: StrategyAllocation) => void;
  disabled?: boolean;
  /** Optional fund id — if provided, live sub-vault APYs are rendered inline. */
  fundId?: bigint;
}

const SLOT_COLORS = ["#10b981", "#f59e0b"] as const;
const SLOT_LABELS = ["Aave USDC", "Fixed 8%"] as const;

type SlotKey = keyof StrategyAllocation;
const SLOT_KEYS: SlotKey[] = ["aaveUsdcBps", "fixedBps"];

export function StrategySliders({
  value,
  onChange,
  disabled,
  fundId,
}: StrategySlidersProps) {
  const { metrics } = useSubVaultMetrics(fundId);

  const bps = useMemo<[number, number]>(
    () => [value.aaveUsdcBps, value.fixedBps],
    [value.aaveUsdcBps, value.fixedBps],
  );
  const sum = bps[0] + bps[1];
  const isValid = sum === 10_000;

  const handleChange = useCallback(
    (idx: number, newVal: number) => {
      // Auto-balance: move the counter slot to keep sum = 10_000.
      const clamped = Math.max(0, Math.min(10_000, newVal));
      const other = 10_000 - clamped;
      onChange({
        aaveUsdcBps: idx === 0 ? clamped : other,
        fixedBps: idx === 1 ? clamped : other,
      });
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-4">
      {SLOT_KEYS.map((_key, i) => {
        const color = SLOT_COLORS[i];
        const label = SLOT_LABELS[i];
        const val = bps[i];
        const apyPct = metrics.apys[i] ? (metrics.apys[i] / 100).toFixed(2) : null;
        return (
          <div key={label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-text-heading">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: color }}
                />
                {label}
                {apyPct && (
                  <span className="text-xs text-text-muted">· {apyPct}% APY</span>
                )}
              </label>
              <span
                className="min-w-[3rem] text-right text-sm font-bold"
                style={{ color }}
              >
                {(val / 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10_000}
              step={100}
              value={val}
              disabled={disabled}
              onChange={(e) => handleChange(i, Number(e.target.value))}
              className="w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{ accentColor: color }}
            />
          </div>
        );
      })}

      <div
        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium ${
          isValid
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-rose-500/10 text-rose-400"
        }`}
      >
        <span>Sum</span>
        <span>
          {(sum / 100).toFixed(0)}% {isValid ? "✓" : `(must be 100%)`}
        </span>
      </div>

      <p className="text-xs text-text-muted">
        Public 2-way allocation between Aave USDC (variable ~4% APY) and a
        Fixed 8% APY reward pool. Strategy is fully transparent — depositor
        position sizes are private.
      </p>
    </div>
  );
}
