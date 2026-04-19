"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Scramble } from "@/components/shadow-fund/primitives/scramble";
import { Ticker } from "@/components/shadow-fund/primitives/ticker";
import { SfButton } from "@/components/shadow-fund/primitives/sf-button";
import { Eyebrow } from "@/components/shadow-fund/primitives/eyebrow";
import { useFundList } from "@/hooks/use-fund-list";

function CubeFace({
  transform,
  children,
}: {
  transform: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform,
        background: "oklch(0.14 0.008 60 / 0.92)",
        border: "1px solid var(--pearl)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 14,
        boxShadow:
          "inset 0 0 20px oklch(0.92 0.02 90 / 0.08), 0 0 25px oklch(0.92 0.02 90 / 0.25)",
        backfaceVisibility: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function HeroVault3D() {
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        angle: (360 / 8) * i,
        radius: 230 + (i % 3) * 25,
        speed: 12 + (i % 4) * 3,
        size: 5 + (i % 3),
        delay: -i * 1.3,
      })),
    []
  );

  const ticks = useMemo(() => Array.from({ length: 48 }, (_, i) => i), []);

  return (
    <div
      style={{
        width: "100%",
        height: 720,
        position: "relative",
        perspective: 1600,
        perspectiveOrigin: "50% 45%",
        overflow: "visible",
        animation: "fade-up 800ms ease-out",
      }}
    >
      {/* Ambient glow behind the whole scene */}
      <div
        style={{
          position: "absolute",
          inset: "12% 8%",
          background:
            "radial-gradient(60% 60% at 50% 50%, oklch(0.92 0.02 90 / 0.12), transparent 70%)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      {/* 3D stage */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          animation: "vault-tumble 24s linear infinite",
        }}
      >
        {/* Outer ring — tick marks */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 560,
            height: 560,
            marginLeft: -280,
            marginTop: -280,
            transformStyle: "preserve-3d",
            transform: "rotateX(72deg)",
            animation: "ring-spin 40s linear infinite",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "1px solid oklch(0.92 0.02 90 / 0.22)",
              borderRadius: "50%",
            }}
          />
          {ticks.map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 1,
                height: i % 4 === 0 ? 18 : 8,
                marginLeft: -0.5,
                background:
                  i % 4 === 0
                    ? "var(--pearl)"
                    : "oklch(0.92 0.02 90 / 0.35)",
                transformOrigin: "50% 0",
                transform: `rotate(${(360 / 48) * i}deg) translateY(272px)`,
              }}
            />
          ))}
        </div>

        {/* Middle ring — dashed pearl, tilted other way */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 460,
            height: 460,
            marginLeft: -230,
            marginTop: -230,
            transformStyle: "preserve-3d",
            transform: "rotateX(68deg) rotateZ(30deg)",
            animation: "ring-spin-reverse 28s linear infinite",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "1px dashed oklch(0.92 0.02 90 / 0.5)",
              borderRadius: "50%",
            }}
          />
        </div>

        {/* Inner ring — solid, with 4 accent nodes */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 370,
            height: 370,
            marginLeft: -185,
            marginTop: -185,
            transformStyle: "preserve-3d",
            transform: "rotateX(60deg) rotateY(20deg)",
            animation: "ring-spin 18s linear infinite",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "1px solid var(--pearl)",
              borderRadius: "50%",
              boxShadow:
                "0 0 40px oklch(0.92 0.02 90 / 0.3), inset 0 0 30px oklch(0.92 0.02 90 / 0.15)",
            }}
          />
          {[0, 90, 180, 270].map((deg) => (
            <div
              key={deg}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 10,
                height: 10,
                marginLeft: -5,
                marginTop: -5,
                background: "var(--pearl)",
                borderRadius: 999,
                boxShadow: "0 0 14px var(--pearl)",
                transform: `rotate(${deg}deg) translateX(185px)`,
              }}
            />
          ))}
        </div>

        {/* Orbiting particles */}
        {particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transformStyle: "preserve-3d",
              animation: `orbit-${i % 3} ${p.speed}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          >
            <div
              style={{
                position: "absolute",
                width: p.size,
                height: p.size,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                left: p.radius,
                top: 0,
                background: "var(--pearl)",
                borderRadius: 999,
                boxShadow:
                  "0 0 8px var(--pearl), 0 0 16px oklch(0.92 0.02 90 / 0.5)",
              }}
            />
          </div>
        ))}

        {/* Central rotating cube — the "vault" */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 180,
            height: 180,
            marginLeft: -90,
            marginTop: -90,
            transformStyle: "preserve-3d",
            animation: "cube-spin 16s ease-in-out infinite",
          }}
        >
          <CubeFace transform="translateZ(90px)">
            <div className="eyebrow" style={{ color: "var(--pearl)", fontSize: 9 }}>
              Sealed Balance
            </div>
            <Scramble
              value="42180955"
              length={10}
              resolved={false}
              style={{ fontSize: 18, marginTop: 8 }}
            />
            <div
              className="mono"
              style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 6 }}
            >
              cUSDC
            </div>
          </CubeFace>
          <CubeFace transform="rotateY(180deg) translateZ(90px)">
            <div className="eyebrow" style={{ color: "var(--pearl)", fontSize: 9 }}>
              Strategy
            </div>
            <div style={{ fontSize: 13, marginTop: 8 }} className="display">
              Aave v3
            </div>
            <div
              className="mono"
              style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 6 }}
            >
              public
            </div>
          </CubeFace>
          <CubeFace transform="rotateY(90deg) translateZ(90px)">
            <div className="eyebrow" style={{ color: "var(--pearl)", fontSize: 9 }}>
              Yield 30d
            </div>
            <div
              className="mono"
              style={{ fontSize: 15, color: "var(--green)", marginTop: 8 }}
            >
              <Ticker
                value={9.81}
                format={(v) => "+" + v.toFixed(2) + "%"}
                interval={700}
                jitter={0.0008}
              />
            </div>
            <div
              className="mono"
              style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 6 }}
            >
              live · apy
            </div>
          </CubeFace>
          <CubeFace transform="rotateY(-90deg) translateZ(90px)">
            <div className="eyebrow" style={{ color: "var(--pearl)", fontSize: 9 }}>
              Depositors
            </div>
            <div className="mono" style={{ fontSize: 18, marginTop: 8 }}>
              1,331
            </div>
            <div
              className="mono"
              style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 6 }}
            >
              balances sealed
            </div>
          </CubeFace>
          <CubeFace transform="rotateX(90deg) translateZ(90px)">
            <div
              className="display-italic"
              style={{
                fontSize: 32,
                color: "var(--pearl)",
                letterSpacing: "-0.03em",
              }}
            >
              SF
            </div>
          </CubeFace>
          <CubeFace transform="rotateX(-90deg) translateZ(90px)">
            <div
              className="display-italic"
              style={{
                fontSize: 32,
                color: "var(--pearl)",
                letterSpacing: "-0.03em",
              }}
            >
              SF
            </div>
          </CubeFace>
        </div>
      </div>

      {/* Foreground lock indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          border: "1px solid oklch(0.92 0.02 90 / 0.3)",
          background: "oklch(0.14 0.008 60 / 0.7)",
          backdropFilter: "blur(6px)",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            background: "var(--pearl)",
            borderRadius: 999,
            animation: "blink 1.6s infinite",
          }}
        />
        <span
          className="eyebrow mono"
          style={{ fontSize: 9, color: "var(--pearl)" }}
        >
          iExec Nox · encrypting
        </span>
      </div>

      <style>{`
        @keyframes vault-tumble {
          0%   { transform: rotateX(-2deg) rotateY(0deg); }
          50%  { transform: rotateX(2deg) rotateY(180deg); }
          100% { transform: rotateX(-2deg) rotateY(360deg); }
        }
        @keyframes ring-spin {
          to { transform: rotateX(72deg) rotateZ(360deg); }
        }
        @keyframes ring-spin-reverse {
          from { transform: rotateX(68deg) rotateZ(30deg); }
          to   { transform: rotateX(68deg) rotateZ(-330deg); }
        }
        @keyframes cube-spin {
          0%   { transform: rotateX(-15deg) rotateY(0deg) rotateZ(0deg); }
          25%  { transform: rotateX(-15deg) rotateY(90deg) rotateZ(0deg); }
          50%  { transform: rotateX(15deg) rotateY(180deg) rotateZ(0deg); }
          75%  { transform: rotateX(15deg) rotateY(270deg) rotateZ(0deg); }
          100% { transform: rotateX(-15deg) rotateY(360deg) rotateZ(0deg); }
        }
        @keyframes orbit-0 {
          from { transform: rotateX(70deg) rotateZ(0deg); }
          to   { transform: rotateX(70deg) rotateZ(360deg); }
        }
        @keyframes orbit-1 {
          from { transform: rotateX(65deg) rotateY(25deg) rotateZ(0deg); }
          to   { transform: rotateX(65deg) rotateY(25deg) rotateZ(-360deg); }
        }
        @keyframes orbit-2 {
          from { transform: rotateX(75deg) rotateY(-15deg) rotateZ(0deg); }
          to   { transform: rotateX(75deg) rotateY(-15deg) rotateZ(360deg); }
        }
      `}</style>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div
      style={{
        padding: "36px 24px",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="eyebrow">{label}</div>
      <div
        className="display"
        style={{
          fontSize: 26,
          marginTop: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 6,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

export function HeroSection() {
  const { funds, count, isLoading } = useFundList();

  const totalDepositors = funds.reduce(
    (sum, f) => sum + Number(f.depositorCount),
    0
  );

  return (
    <section
      style={{
        position: "relative",
        padding: "80px 32px 60px",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 48,
          alignItems: "start",
        }}
      >
        <div>
          <Eyebrow dot>Private DeFi · Powered by iExec Nox</Eyebrow>
          <h1
            className="display"
            style={{
              fontSize: "clamp(56px, 9vw, 112px)",
              lineHeight: 0.95,
              marginTop: 32,
              letterSpacing: "-0.035em",
              fontWeight: 500,
            }}
          >
            Yield without
            <br />
            <span className="display-italic" style={{ color: "var(--pearl)" }}>
              disclosure
            </span>
            .
          </h1>
          <p
            style={{
              marginTop: 36,
              maxWidth: 580,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--text-dim)",
            }}
          >
            ShadowFund is a confidential vault protocol. Managers publish their
            strategies openly. Depositors allocate with{" "}
            <em style={{ color: "var(--text)", fontStyle: "normal" }}>cUSDC</em>{" "}
            — and every individual balance stays encrypted on-chain. Transparent
            where it matters. Private where it counts.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 44 }}>
            <Link href="/funds">
              <SfButton variant="primary" size="lg">
                Browse Vaults →
              </SfButton>
            </Link>
            <Link href="/dashboard/manager">
              <SfButton variant="secondary" size="lg">
                Launch a Vault
              </SfButton>
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              marginTop: 80,
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <HeroMetric
              label="Vaults"
              value={isLoading ? "—" : String(count)}
              sub="active"
            />
            <HeroMetric
              label="Depositors"
              value={isLoading ? "—" : totalDepositors > 0 ? totalDepositors.toLocaleString() : "—"}
              sub="balances sealed"
            />
          </div>
        </div>
        <div>
          <HeroVault3D />
        </div>
      </div>
    </section>
  );
}
