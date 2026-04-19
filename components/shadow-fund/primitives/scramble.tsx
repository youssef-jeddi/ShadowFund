"use client";

import { useEffect, useReducer, useRef, useState } from "react";

const CHARS = "0123456789ABCDEF";

function rnd(chars: string) {
  return chars[Math.floor(Math.random() * chars.length)];
}

interface ScrambleProps {
  value: string;
  length?: number;
  prefix?: string;
  suffix?: string;
  resolved?: boolean;
  chars?: string;
  speed?: number;
  cascadeMs?: number;
  cascadeDelay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Scramble({
  value,
  length,
  prefix = "",
  suffix = "",
  resolved = false,
  chars = CHARS,
  speed = 55,
  cascadeMs = 650,
  cascadeDelay = 0,
  className = "",
  style = {},
}: ScrambleProps) {
  const str = String(value);
  const len = length ?? str.length;

  // SSR: stable placeholder
  const [mounted, setMounted] = useState(false);
  const [display, setDisplay] = useState(() => "•".repeat(len));
  const [cascade, setCascade] = useState(0);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const prevResolved = useRef(false);

  // Hydration safety
  useEffect(() => {
    setMounted(true);
    if (resolved) {
      prevResolved.current = true;
      setCascade(1);
      setDisplay(str);
    } else {
      setDisplay(Array.from({ length: len }, () => rnd(chars)).join(""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transition: locked → unlocked
  useEffect(() => {
    if (!mounted) return;
    if (resolved && !prevResolved.current) {
      prevResolved.current = true;
      setCascade(0);
      const startAt = Date.now() + cascadeDelay;
      const id = setInterval(() => {
        const now = Date.now();
        if (now < startAt) return;
        const p = Math.min(1, (now - startAt) / cascadeMs);
        setCascade(p);
        if (p >= 1) clearInterval(id);
      }, 33);
      return () => clearInterval(id);
    }
    if (!resolved && prevResolved.current) {
      prevResolved.current = false;
      setCascade(0);
    }
  }, [resolved, mounted, cascadeMs, cascadeDelay]);

  // Locked: churn random glyphs
  useEffect(() => {
    if (!mounted || resolved) return;
    const id = setInterval(() => {
      setDisplay(Array.from({ length: len }, () => rnd(chars)).join(""));
    }, speed);
    return () => clearInterval(id);
  }, [mounted, resolved, len, chars, speed]);

  // Cascade animation: re-render every 40ms while in progress
  useEffect(() => {
    if (!mounted || !resolved || cascade >= 1) return;
    const id = setInterval(bump, 40);
    return () => clearInterval(id);
  }, [mounted, resolved, cascade]);

  // Fully resolved
  useEffect(() => {
    if (resolved && cascade >= 1) setDisplay(str);
  }, [resolved, cascade, str]);

  let out: string;
  if (!mounted) {
    out = "•".repeat(len);
  } else if (resolved && cascade < 1) {
    const resolved_count = Math.floor(cascade * str.length);
    const rest = Array.from({ length: Math.max(0, len - resolved_count) }, () => rnd(chars)).join("");
    out = str.slice(0, resolved_count) + rest;
  } else if (resolved) {
    out = str;
  } else {
    out = display;
  }

  const color = resolved ? "var(--text)" : "var(--pearl)";

  return (
    <span
      className={`mono tabular ${className}`}
      style={{ color, letterSpacing: "0.02em", transition: "color 300ms", ...style }}
    >
      {prefix}{out}{suffix}
    </span>
  );
}
