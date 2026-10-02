import React from "react";
import { staticFile } from "remotion";
import world from "../data/world.json";
import { MONO } from "../lib/fonts";
import { GlowFilter } from "../lib/Glow";
import { easeOutBack, phase, saw } from "../lib/loop";
import type { HudPalette } from "./palettes";

// World map from Natural Earth 1:110m (public domain), see scripts/build-map.mjs.
export const MAP_W = world.width;
export const MAP_H = world.height;
export const project = (lon: number, lat: number): [number, number] => [
  ((lon + 180) / 360) * MAP_W,
  ((world.latTop - lat) / (world.latTop - world.latBottom)) * MAP_H,
];

export const WorldMap: React.FC<{
  mode: "dots" | "outline" | "fill" | "none";
  color: string;
  opacity?: number;
  dot?: number;
  children?: React.ReactNode;
}> = ({ mode, color, opacity = 1, dot = 2.2, children }) => (
  <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible" }}>
    {mode === "none" ? null : mode === "fill" ? (
      <>
        <path d={world.outline} fill={color} fillOpacity={opacity * 0.42} stroke={color} strokeOpacity={opacity * 0.5} strokeWidth={0.6} strokeLinejoin="round" />
        <path d={world.dots} stroke={color} strokeOpacity={opacity * 0.9} strokeWidth={dot} strokeLinecap="round" fill="none" />
      </>
    ) : mode === "dots" ? (
      <path d={world.dots} stroke={color} strokeOpacity={opacity} strokeWidth={dot} strokeLinecap="round" fill="none" />
    ) : (
      <path d={world.outline} stroke={color} strokeOpacity={opacity} strokeWidth={0.9} fill={color} fillOpacity={opacity * 0.08} strokeLinejoin="round" />
    )}
    {children}
  </svg>
);

// Warning triangle symbol, drawn here. `s` = side length in local units.
const triD = (cx: number, cy: number, s: number) => {
  const h = (s * Math.sqrt(3)) / 2;
  return `M${cx} ${cy - h * 0.58}L${cx + s / 2} ${cy + h * 0.42}L${cx - s / 2} ${cy + h * 0.42}Z`;
};

export const WarningIcon: React.FC<{ p: HudPalette; id: string; glow?: number; label?: string; filled?: boolean }> = ({ p, id, glow = 1, label, filled }) => {
  const s = 100;
  const h = (s * Math.sqrt(3)) / 2;
  const mark = (stroke: string, w: number, dx = 0) => (
    <g stroke={stroke} strokeWidth={w} strokeLinecap="round" fill="none" transform={`translate(${dx} 0)`}>
      <path d={`M60 ${60 - h * 0.22}L60 ${60 + h * 0.12}`} />
      <path d={`M60 ${60 + h * 0.26}L60 ${60 + h * 0.26 + 0.3}`} />
    </g>
  );
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>
      <defs>
        <GlowFilter id={id} base={1.6} gain={glow} weights={[1, 0.7, 0.45]} />
      </defs>
      {/* chromatic fringe */}
      <g opacity={0.35} style={{ mixBlendMode: "screen" }}>
        <path d={triD(58.6, 60, s)} fill="none" stroke="#00e5ff" strokeWidth={3} strokeLinejoin="round" />
        <path d={triD(61.4, 60, s)} fill="none" stroke="#ff00aa" strokeWidth={3} strokeLinejoin="round" />
      </g>
      {filled ? (
        <>
          {/* solid sign with a dark exclamation mark cut out */}
          <g filter={`url(#${id})`}>
            <path d={triD(60, 60, s)} fill={p.alert} stroke={p.alert} strokeWidth={8} strokeLinejoin="round" />
          </g>
          <path d={triD(60, 60, s * 0.9)} fill={p.alertCore} fillOpacity={0.18} />
          {mark("#1a0208", 10)}
        </>
      ) : (
        <>
          <g filter={`url(#${id})`}>
            <path d={triD(60, 60, s)} fill={`${p.alert}22`} stroke={p.alert} strokeWidth={6} strokeLinejoin="round" />
            {mark(p.alert, 11)}
          </g>
          <path d={triD(60, 60, s)} fill="none" stroke={p.alertCore} strokeWidth={2} strokeLinejoin="round" opacity={0.85} />
          {mark(p.alertCore, 4.5)}
        </>
      )}
      {label ? (
        <text x={60} y={128} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={11} letterSpacing={1.5} fill={p.alert}>
          {label}
        </text>
      ) : null}
    </svg>
  );
};

/** Pop-in with overshoot, hold, fade-out. Visible from the first frame. */
export const popState = (f: number, start: number, len: number) => {
  const t = f - start;
  if (t < 0 || t >= len) return null;
  const scale = 0.3 + 0.7 * easeOutBack((t + 1) / 9);
  const fadeIn = Math.min(1, (t + 1) / 3);
  const fadeOut = Math.min(1, (len - t) / 10);
  return { scale, opacity: Math.min(fadeIn, fadeOut) };
};

const USER = "admin_console";
const PASS_LEN = 12;
const CYCLE = 120; // 5 typing cycles per loop (120 does not divide the 150-frame check spacing)

/** Map panel with markers, connection arcs and documentation-range IPs. */
const NODES: { lon: number; lat: number; ip: string }[] = [
  { lon: -74, lat: 40.7, ip: "203.0.113.24" },
  { lon: -0.1, lat: 51.5, ip: "198.51.100.7" },
  { lon: 139.7, lat: 35.7, ip: "192.0.2.144" },
  { lon: 151.2, lat: -33.9, ip: "203.0.113.91" },
  { lon: -46.6, lat: -23.5, ip: "198.51.100.63" },
  { lon: 77.2, lat: 28.6, ip: "192.0.2.18" },
  { lon: 18.4, lat: -33.9, ip: "203.0.113.200" },
  { lon: -122.4, lat: 37.8, ip: "198.51.100.152" },
];
const LINKS: [number, number, number][] = [
  [0, 1, 1], [1, 5, 2], [5, 2, 1], [7, 2, 2], [4, 6, 1], [2, 3, 3], [0, 4, 2], [1, 6, 1],
];

export const ThreatMap: React.FC<{ p: HudPalette; f: number; mode: "dots" | "outline" | "fill" | "none"; labels?: boolean; dot?: number; opacity?: number }> = ({ p, f, mode, labels = true, dot, opacity = 0.8 }) => (
  <WorldMap mode={mode} color={p.map} opacity={opacity} dot={dot}>
    <g fill="none" strokeLinecap="round">
      {LINKS.map(([a, b, cyc], i) => {
        const [x1, y1] = project(NODES[a].lon, NODES[a].lat);
        const [x2, y2] = project(NODES[b].lon, NODES[b].lat);
        const mx = (x1 + x2) / 2;
        const my = Math.min(y1, y2) - Math.hypot(x2 - x1, y2 - y1) * 0.35;
        const d = `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`;
        const s = saw(f, cyc, i * 0.17);
        return (
          <g key={i}>
            <path d={d} stroke={p.line} strokeOpacity={0.35} strokeWidth={1} />
            <path d={d} stroke={p.alert} strokeWidth={2} pathLength={100} strokeDasharray="12 200" strokeDashoffset={12 - s * 112} />
          </g>
        );
      })}
    </g>
    {NODES.map((n, i) => {
      const [x, y] = project(n.lon, n.lat);
      const ring = saw(f, 6, i * 0.13);
      return (
        <g key={i}>
          <circle cx={x} cy={y} r={3 + ring * 16} fill="none" stroke={p.alert} strokeWidth={1.4} strokeOpacity={1 - ring} />
          <circle cx={x} cy={y} r={3.2} fill={p.alert} />
          {labels ? (
            <text x={x + 7} y={y - 6} fontFamily={MONO} fontSize={9} fill={p.text} opacity={0.9}>
              {n.ip}
            </text>
          ) : null}
        </g>
      );
    })}
  </WorldMap>
);

/** Compact login widget: label above a field, as in the reference. */
export const MiniLogin: React.FC<{ p: HudPalette; u: number; f: number; offset: number; w: number }> = ({ p, u, f, offset, w }) => {
  const cf = (f + offset) % CYCLE;
  const typed = USER.slice(0, Math.max(0, Math.min(USER.length, Math.floor((cf - 6) / 2))));
  const dots = Math.max(0, Math.min(PASS_LEN, Math.floor((cf - 40) / 2)));
  const cursorOn = Math.floor(f / 10) % 2 === 0;
  const inUser = cf < 36;
  const fs = w * 0.06;
  const lab: React.CSSProperties = { fontFamily: MONO, fontWeight: 700, fontSize: fs * u, letterSpacing: fs * 0.08 * u, color: p.accent, lineHeight: 1.1 };
  const box = (content: React.ReactNode, active: boolean): React.ReactNode => (
    <div
      style={{
        marginTop: fs * 0.35 * u,
        marginBottom: fs * 0.7 * u,
        height: fs * 1.75 * u,
        background: p.field,
        border: `${Math.max(1, fs * 0.11 * u)}px solid ${p.accent}`,
        borderRadius: fs * 0.15 * u,
        fontFamily: MONO,
        fontSize: fs * 1.05 * u,
        lineHeight: `${fs * 1.75 * u}px`,
        paddingLeft: fs * 0.5 * u,
        color: p.accent,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      {content}
      {active && cursorOn ? <span style={{ display: "inline-block", width: fs * 0.5 * u, height: fs * 1.05 * u, background: p.accent, verticalAlign: "middle", marginLeft: fs * 0.1 * u }} /> : null}
    </div>
  );
  return (
    <div style={{ width: w * u }}>
      <div style={lab}>USERNAME:</div>
      {box(typed, inUser)}
      <div style={lab}>PASSWORD:</div>
      {box("\u2022".repeat(dots), !inUser && dots < PASS_LEN)}
    </div>
  );
};

/** Loose block of scrolling code text (no panel), as in the reference. */
export const CodeText: React.FC<{ lines: string[]; laps: number; f: number; u: number; color: string; dim: string; hot: string; size: number; rows: number; hotEvery?: number }> = ({ lines, laps, f, u, color, dim, hot, size, rows, hotEvery = 0 }) => {
  const L = lines.length;
  const lh = size * 1.35;
  const off = phase(f) * L * laps;
  const base = Math.floor(off);
  const frac = off - base;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: -frac * lh * u, fontFamily: MONO, fontSize: size * u, lineHeight: `${lh * u}px`, whiteSpace: "pre", fontVariantLigatures: "none" }}>
        {Array.from({ length: rows + 1 }, (_, k) => {
          const i = (base + k) % L;
          const c = hotEvery && i % hotEvery === 3 ? hot : i % 4 === 0 ? dim : color;
          return <div key={k} style={{ color: c }}>{lines[i]}</div>;
        })}
      </div>
    </div>
  );
};

/**
 * Natural Earth map drawn from the pre-rendered texture (public/map/world-fill.png,
 * built by scripts/build-map-texture.sh) as a mask tinted with `color`, faded
 * at the edges. A bitmap mask renders identically in every render, unlike
 * the very large map paths. `dx` offsets it (for the chromatic fringe).
 */
export const MapMask: React.FC<{ color: string; opacity: number; dx?: number; blend?: boolean }> = ({ color, opacity, dx = 0, blend }) => {
  const tex = `url(${staticFile("map/world-fill.png")}) center / contain no-repeat`;
  const fade = "radial-gradient(ellipse 50% 50% at 50% 50%, black 55%, transparent 100%)";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: dx ? `translateX(${dx}px)` : undefined,
        background: color,
        opacity,
        mixBlendMode: blend ? "screen" : undefined,
        mask: `${tex}, ${fade}`,
        WebkitMask: `${tex}, ${fade}`,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    />
  );
};
