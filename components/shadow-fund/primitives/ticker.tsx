"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface TickerProps {
  value: number;
  format?: (v: number) => string;
  interval?: number;
  jitter?: number;
  style?: CSSProperties;
}

export function Ticker({
  value,
  format = (v) => v.toFixed(2),
  interval = 80,
  jitter = 0.0002,
  style = {},
}: TickerProps) {
  const [display, setDisplay] = useState(value);
  const valRef = useRef(value);

  useEffect(() => {
    valRef.current = value;
  }, [value]);

  useEffect(() => {
    const id = setInterval(() => {
      valRef.current = valRef.current * (1 + (Math.random() - 0.3) * jitter);
      setDisplay(valRef.current);
    }, interval);
    return () => clearInterval(id);
  }, [interval, jitter]);

  return (
    <span className="mono tabular" style={style}>
      {format(display)}
    </span>
  );
}
