"use client";

import { useState, useCallback } from "react";
import type { StrategyAllocation } from "@/hooks/use-set-strategy";

interface StrategySlidersProps {
  value: StrategyAllocation;
  onChange: (allocation: StrategyAllocation) => void;
  disabled?: boolean;
}

const ASSETS: { key: keyof StrategyAllocation; label: string; color: string }[] = [
  { key: "eth",  label: "ETH",  color: "#6366f1" },
  { key: "btc",  label: "BTC",  color: "#f59e0b" },
  { key: "link", label: "LINK", color: "#3b82f6" },
  { key: "usdc", label: "USDC", color: "#10b981" },
];

export function StrategySliders({ value, onChange, disabled }: StrategySlidersProps) {
  const total = value.eth + value.btc + value.link + value.usdc;
  const remaining = 100 - total;

  const handleChange = useCallback(
    (key: keyof StrategyAllocation, newVal: number) => {
      const updated = { ...value, [key]: newVal };
      onChange(updated);
    },
    [value, onChange],
  );

  return (
    <div className="flex flex-col gap-5">
      {ASSETS.map(({ key, label, color }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-text-heading">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: color }}
              />
              {label}
            </label>
            <span className="min-w-[3rem] text-right text-sm font-bold"
              style={{ color }}>
              {value[key]}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value[key]}
            disabled={disabled}
            onChange={(e) => handleChange(key, Number(e.target.value))}
            className="w-full cursor-pointer accent-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ accentColor: color }}
          />
        </div>
      ))}

      {/* Sum indicator */}
      <div
        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
          total === 100
            ? "bg-emerald-500/10 text-emerald-400"
            : total > 100
            ? "bg-red-500/10 text-red-400"
            : "bg-amber-500/10 text-amber-400"
        }`}
      >
        <span>Total allocation</span>
        <span>{total}%</span>
      </div>

      {total !== 100 && (
        <p className="text-xs text-text-muted">
          {remaining > 0
            ? `Allocate ${remaining}% more to reach 100%`
            : `Over-allocated by ${Math.abs(remaining)}% — reduce one or more sliders`}
        </p>
      )}
    </div>
  );
}
