import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Grain } from "../lib/Grain";
import { clamp, smooth, TAU } from "../lib/random";
import { TreeVersion } from "../versions";
import { BASE, DUST, GRASS, GROW_END, H, HOLD, ICON_PATHS, makeIcons, TREE, W } from "./geometry";

// Hold-phase time: identical at 240 and 600 (whole cycles over 360 frames).
const holdPhase = (f: number, period: number, off = 0) => {
  const x = (f - GROW_END + off) % period;
  return (x < 0 ? x + period : x) / period;
};

export const CircuitTree: React.FC<{ version: TreeVersion }> = ({ version: v }) => {
  const frame = useCurrentFrame();
  const f = frame;
  const icons = useMemo(() => makeIcons(v), [v]);
  const seed = f < GROW_END ? f : GROW_END + ((f - GROW_END) % HOLD);
  const cyc = (k: number, ph: number) => Math.sin(TAU * k * holdPhase(f, HOLD) + ph);

  const traces = TREE.traces.map((t, i) => {
    const p = clamp((f - t.t0) / Math.max(1, t.t1 - t.t0));
    return { t, i, p };
  });

  // Glow is built from stacked translucent strokes (no CSS/SVG blur filters,
  // which Chromium may rasterise differently depending on prior frames).
  const traceEls = (widthK: number, opacity: number, color = v.trace) =>
    traces.map(({ t, i, p }) =>
      p <= 0 ? null : (
        <path
          key={i}
          d={t.d}
          fill="none"
          stroke={color}
          strokeWidth={t.width * widthK}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${t.len + 2} ${t.len + 2}`}
          strokeDashoffset={(t.len + 2) * (1 - p)}
          opacity={opacity}
        />
      ),
    );

  const baseOn = smooth(0, 30, f);
  const basePulse = 0.85 + 0.15 * cyc(2, 0);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${v.bgTop} 0%, ${v.bgBottom} 100%)` }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="baseGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <stop offset="0.12" stopColor={v.glow} stopOpacity={0.85} />
            <stop offset="0.45" stopColor={v.glow} stopOpacity={0.25} />
            <stop offset="1" stopColor={v.glow} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="crown" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={v.glow} stopOpacity={0.16} />
            <stop offset="1" stopColor={v.glow} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="padGlow">
            <stop offset="0" stopColor={v.trace} stopOpacity={0.45} />
            <stop offset="1" stopColor={v.trace} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="padGlowPink">
            <stop offset="0" stopColor={v.pad} stopOpacity={0.55} />
            <stop offset="1" stopColor={v.pad} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="grassFade" x1="0" y1={H} x2="0" y2={H - 620} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={v.grass} stopOpacity={0.9} />
            <stop offset="1" stopColor={v.grass} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* dust */}
        {DUST.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#BFD8FF" opacity={d.a * (0.65 + 0.35 * cyc(d.k, d.ph))} />
        ))}

        {/* crown haze */}
        <ellipse cx={1920} cy={1150} rx={1150} ry={820} fill="url(#crown)" opacity={smooth(60, 240, f)} />

        {/* traces: blurred glow copy + sharp copy */}
        <g>{traceEls(7, 0.07)}</g>
        <g>{traceEls(4.2, 0.12)}</g>
        <g>{traceEls(2.2, 0.25)}</g>
        <g>{traceEls(1, 0.95)}</g>
        <g>{traceEls(0.45, 0.35, "#FFFFFF")}</g>

        {/* light pulses running up the traces (hold section, loop-safe) */}
        <g>
          {traces.map(({ t, i }) => {
            if (!t.pulse) return null;
            const on = smooth(t.t1, t.t1 + 25, f);
            if (on <= 0) return null;
            const L = 70;
            const ph = holdPhase(f, t.pulse.period, t.pulse.off);
            const s = ph * (t.len + L) - L;
            return (
              <g key={i}>
                {[
                  [4, 0.12],
                  [2.2, 0.3],
                  [1.1, 0.95],
                ].map(([wk, op]) => (
                  <path
                    key={wk}
                    d={t.d}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={t.width * wk}
                    strokeLinecap="round"
                    strokeDasharray={`${L} ${t.len + L * 3}`}
                    strokeDashoffset={-s}
                    opacity={on * op}
                  />
                ))}
              </g>
            );
          })}
        </g>

        {/* vias at bends */}
        {traces.map(({ t, i, p }) =>
          p >= 1 ? t.bends.map((b, k) => <circle key={`${i}-${k}`} cx={b[0]} cy={b[1]} r={t.width * 0.9} fill={v.trace} opacity={0.9} />) : null,
        )}

        {/* pads */}
        {traces.map(({ t, i, p }) => {
          if (!t.pad || p < 1) return null;
          const a = smooth(t.t1, t.t1 + 10, f);
          const pink = t.pad === 2;
          const tw = pink ? 0.75 + 0.25 * Math.sin(TAU * 2 * holdPhase(f, HOLD) + i) : 1;
          return (
            <g key={i} opacity={a}>
              <circle cx={t.end[0]} cy={t.end[1]} r={30} fill={pink ? "url(#padGlowPink)" : "url(#padGlow)"} opacity={tw} />
              <circle cx={t.end[0]} cy={t.end[1]} r={9} fill={v.bgTop} stroke={pink ? v.pad : v.trace} strokeWidth={4} />
              <circle cx={t.end[0]} cy={t.end[1]} r={4} fill={pink ? v.pad : "#FFFFFF"} opacity={tw} />
            </g>
          );
        })}

        {/* canopy icons */}
        {icons.map((ic, i) => {
          const a = smooth(ic.t, ic.t + 14, f);
          if (a <= 0) return null;
          const sc = 0.4 + 0.6 * smooth(ic.t, ic.t + 10, f);
          let x = ic.x;
          let y = ic.y;
          let o = a * (1 - ic.tw.amp * (0.5 + 0.5 * cyc(ic.tw.k, ic.tw.ph)));
          if (ic.drift) {
            const ph = holdPhase(f, ic.drift.period, ic.drift.off);
            y -= ph * ic.drift.rise;
            x += Math.sin(ph * TAU) * ic.drift.sway;
            o *= smooth(0, 0.15, ph) * (1 - smooth(0.55, 1, ph));
          }
          const col = v.canopy[ic.color];
          return (
            <path
              key={i}
              d={ICON_PATHS[ic.shape]}
              transform={`translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${ic.rot}) scale(${(ic.s * sc).toFixed(3)})`}
              fill={col}
              fillRule="evenodd"
              stroke={ic.shape === 3 ? "#FFFFFF" : "none"}
              strokeWidth={ic.shape === 3 ? 0.06 : 0}
              opacity={o}
            />
          );
        })}

        {/* base pad + roots */}
        <ellipse cx={BASE.x} cy={BASE.y + 30} rx={520} ry={190} fill="url(#baseGlow)" opacity={baseOn * basePulse} />
        <g opacity={baseOn}>
          {TREE.roots.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={v.trace} strokeWidth={5} opacity={0.85} />
          ))}
          <rect x={BASE.x - 130} y={BASE.y - 24} width={260} height={30} rx={8} fill={v.trace} opacity={0.9} />
          <rect x={BASE.x - 110} y={BASE.y - 18} width={220} height={18} rx={6} fill="#FFFFFF" opacity={0.85} />
        </g>

        {/* grass */}
        <g>
          {GRASS.map((b, i) => {
            const gh = b.h * smooth(0, 120, f - (Math.abs(b.x - 1920) / 1920) * 30);
            if (gh < 2) return null;
            const bend = b.lean + b.sway * cyc(b.k, b.ph);
            const x0 = b.x;
            const y0 = H + 6;
            return (
              <path
                key={i}
                d={`M${x0.toFixed(1)},${y0} Q${(x0 + bend * 0.25).toFixed(1)},${(y0 - gh * 0.55).toFixed(1)} ${(x0 + bend).toFixed(1)},${(y0 - gh).toFixed(1)}`}
                fill="none"
                stroke="url(#grassFade)"
                strokeWidth={b.w}
                strokeLinecap="round"
                opacity={b.a}
              />
            );
          })}
        </g>
      </svg>
      <Grain seed={seed} />
    </AbsoluteFill>
  );
};
