import React from "react";
import { withAlpha } from "../../lib/color";
import { INTER, MONO } from "../../lib/fonts";
import { LOOP, TAU, loopSaw, loopSin, loopT, smoothstep } from "../../lib/loop";
import { hash01, mulberry32 } from "../../lib/random";
import { DotsGrid } from "./icons";
import { WORLD_DOTS, project } from "./worldDots";

export type Theme = {
  accent: string;
  secondary: string;
  red: string;
  yellow: string;
  green: string;
  text: string;
  dim: string;
  panel: string;
  bg: string;
};

/* ───────────────────────── Panel frame ───────────────────────── */

export const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  theme: Theme;
  title?: string;
  sub?: string;
  color?: string;
  dots?: boolean;
  children?: React.ReactNode;
}> = ({ x, y, w, h, theme, title, sub, color, dots = true, children }) => {
  const c = color ?? theme.accent;
  const k = 46; // chamfer
  const b = 70; // bracket length
  const outline = `M ${k} 2 H ${w - 2} V ${h - k} L ${w - k} ${h - 2} H 2 V ${k} Z`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={outline} fill={withAlpha(theme.panel, 0.88)} stroke={withAlpha(c, 0.38)} strokeWidth={3} />
        {/* corner brackets */}
        <path
          d={`M 2 ${k + b} V ${k} L ${k} 2 H ${k + b} M ${w - b} 2 H ${w - 2} V ${b} M ${w - 2} ${h - k - b} V ${h - k} L ${w - k} ${h - 2} H ${w - k - b} M ${b} ${h - 2} H 2 V ${h - b}`}
          fill="none"
          stroke={c}
          strokeWidth={6}
          style={{ filter: `drop-shadow(0 0 10px ${withAlpha(c, 0.8)})` }}
        />
      </svg>
      {title ? (
        <div style={{ position: "absolute", left: 70, top: 44, right: 70, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 600,
                fontSize: 54,
                letterSpacing: "0.06em",
                color: theme.text,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
            {sub ? (
              <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 32, letterSpacing: "0.08em", color: theme.dim, marginTop: 6, textTransform: "uppercase" }}>
                {sub}
              </div>
            ) : null}
          </div>
          {dots ? <DotsGrid size={44} color={c} /> : null}
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </div>
  );
};

export const Label: React.FC<{
  x: number;
  y: number;
  size?: number;
  color: string;
  weight?: number;
  mono?: boolean;
  spacing?: string;
  align?: "left" | "center" | "right";
  w?: number;
  glow?: string;
  children: React.ReactNode;
}> = ({ x, y, size = 40, color, weight = 500, mono, spacing = "0.04em", align = "left", w, glow, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      textAlign: align,
      fontFamily: mono ? MONO : INTER,
      fontWeight: weight,
      fontSize: size,
      letterSpacing: spacing,
      color,
      whiteSpace: "nowrap",
      lineHeight: 1.15,
      textShadow: glow ? `0 0 14px ${glow}` : undefined,
    }}
  >
    {children}
  </div>
);

/* ───────────────────────── Status ring ───────────────────────── */

export const StatusRing: React.FC<{
  f: number;
  size: number;
  color: string;
  mode: "secure" | "threat" | "scan";
  icon: React.ReactNode;
  title: string;
  sub: string;
  theme: Theme;
}> = ({ f, size, color, mode, icon, title, sub, theme }) => {
  const t = loopT(f);
  const rotA = 360 * t * (mode === "threat" ? -1 : 1); // 1 turn per loop
  const rotB = -720 * t; // 2 turns per loop
  const pulse = mode === "threat" ? 0.5 + 0.5 * loopSin(f, 12) : 0; // 12 pulses per loop
  const scanRot = 360 * 5 * t; // 5 turns per loop
  const pct = Math.floor(loopSaw(f, 2) * 100);
  const circ = (r: number) => 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 1000 1000" style={{ position: "absolute", overflow: "visible" }}>
        <defs>
          <radialGradient id={`rg-${mode}`}>
            <stop offset="0%" stopColor={color} stopOpacity={0.16 + pulse * 0.12} />
            <stop offset="70%" stopColor={color} stopOpacity={0.04} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={500} cy={500} r={470} fill={`url(#rg-${mode})`} />
        <circle cx={500} cy={500} r={480} fill="none" stroke={color} strokeOpacity={0.3 + pulse * 0.4} strokeWidth={4} />
        <g transform={`rotate(${rotA} 500 500)`} style={{ filter: `drop-shadow(0 0 14px ${color})` }}>
          <circle
            cx={500}
            cy={500}
            r={445}
            fill="none"
            stroke={color}
            strokeWidth={24}
            strokeDasharray={`${circ(445) * 0.22} ${circ(445) * 0.05} ${circ(445) * 0.12} ${circ(445) * 0.1} ${circ(445) * 0.3} ${circ(445) * 0.21}`}
          />
        </g>
        <g transform={`rotate(${rotB} 500 500)`}>
          {Array.from({ length: 90 }, (_, i) => {
            const a = (i / 90) * TAU;
            const r1 = 400;
            const r2 = i % 5 === 0 ? 372 : 386;
            return (
              <line
                key={i}
                x1={500 + Math.cos(a) * r1}
                y1={500 + Math.sin(a) * r1}
                x2={500 + Math.cos(a) * r2}
                y2={500 + Math.sin(a) * r2}
                stroke={color}
                strokeOpacity={0.55}
                strokeWidth={4}
              />
            );
          })}
        </g>
        <circle cx={500} cy={500} r={345} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={6} strokeDasharray={`${circ(345) * 0.7} ${circ(345) * 0.3}`} transform={`rotate(${-rotA * 2 + 40} 500 500)`} />
        {mode === "scan" ? (
          <g transform={`rotate(${scanRot} 500 500)`} style={{ filter: `drop-shadow(0 0 18px ${color})` }}>
            <circle cx={500} cy={500} r={300} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${circ(300) * 0.28} ${circ(300) * 0.72}`} />
          </g>
        ) : null}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: size * 0.24, display: "flex", justifyContent: "center", filter: `drop-shadow(0 0 16px ${color})`, opacity: mode === "threat" ? 0.7 + 0.3 * pulse : 1 }}>
        {icon}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: size * 0.6, textAlign: "center", fontFamily: INTER, fontWeight: 700, fontSize: size * 0.06, letterSpacing: "0.06em", color, textShadow: `0 0 18px ${color}` }}>
        {title}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: size * 0.68, textAlign: "center", fontFamily: mode === "scan" ? MONO : INTER, fontWeight: 500, fontSize: size * 0.04, color: theme.dim }}>
        {mode === "scan" ? `${pct}%` : sub}
      </div>
    </div>
  );
};

/* ───────────────────────── Ring gauge ───────────────────────── */

export const Gauge: React.FC<{ size: number; value: number; color: string; label: string; theme: Theme }> = ({ size, value, color, label, theme }) => {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size * 1.3 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", overflow: "visible" }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke={withAlpha(color, 0.15)} strokeWidth={8} />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          transform="rotate(-90 50 50)"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
        <circle cx={50} cy={50} r={31} fill="none" stroke={withAlpha(color, 0.3)} strokeWidth={1} />
      </svg>
      <div style={{ position: "absolute", top: size * 0.37, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: size * 0.2, color: theme.text }}>
        {Math.round(value)}%
      </div>
      <div style={{ position: "absolute", top: size * 1.06, left: 0, right: 0, textAlign: "center", fontFamily: INTER, fontWeight: 600, fontSize: size * 0.12, letterSpacing: "0.08em", color }}>{label}</div>
    </div>
  );
};

/* ───────────────────────── Periodic series ───────────────────────── */

/** Periodic in u (period 1): only integer frequencies, so u and u+1 match. */
const makeSeries = (seed: number, terms: number, rough: number) => {
  const rnd = mulberry32(seed);
  const comps = Array.from({ length: terms }, (_, i) => {
    const k = i < 3 ? i + 1 : 3 + Math.floor(rnd() * 40);
    return { k, a: (i < 3 ? 1 / (i + 1) : rough / Math.sqrt(k)) * (0.6 + rnd() * 0.4), p: rnd() * TAU };
  });
  return (u: number) => comps.reduce((s, c) => s + c.a * Math.sin(TAU * c.k * u + c.p), 0);
};

const seriesA = makeSeries(101, 14, 0.5);
const seriesB = makeSeries(202, 10, 0.35);
const seriesBars = makeSeries(303, 12, 0.7);

/** Scrolling area chart. The window slides exactly one data period per loop. */
export const AreaChart: React.FC<{ f: number; w: number; h: number; color: string; theme: Theme; seed?: "a" | "b" }> = ({ f, w, h, color, theme, seed = "a" }) => {
  const fn = seed === "a" ? seriesA : seriesB;
  const N = 160;
  const scroll = loopSaw(f, 1); // one period per loop
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const u = scroll + (i / N) * 0.5;
    const v = fn(u);
    pts.push([(i / N) * w, h * 0.55 - v * h * 0.22]);
  }
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const id = `grad-${seed}`;
  return (
    <svg width={w} height={h} style={{ position: "absolute", overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8].map((g) => (
        <line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke={withAlpha(theme.dim, 0.25)} strokeWidth={2} strokeDasharray="6 10" />
      ))}
      <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={4} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  );
};

/** Bar chart whose bars slide left, one full data period per loop. */
export const BarChart: React.FC<{ f: number; w: number; h: number; color: string; n?: number }> = ({ f, w, h, color, n = 64 }) => {
  const scroll = loopSaw(f, 2);
  const bw = w / n;
  return (
    <svg width={w} height={h} style={{ position: "absolute", overflow: "visible" }}>
      {Array.from({ length: n }, (_, i) => {
        const u = scroll + i / (n * 2);
        const v = 0.5 + 0.28 * seriesBars(u) + 0.12 * Math.sin(TAU * (i / n) * 3 + TAU * 4 * loopT(f));
        const bh = Math.max(4, Math.min(1, Math.abs(v)) * h);
        return <rect key={i} x={i * bw + bw * 0.18} y={h - bh} width={bw * 0.64} height={bh} fill={color} opacity={0.55 + 0.45 * Math.min(1, v)} />;
      })}
    </svg>
  );
};

/* ───────────────────────── World threat map ───────────────────────── */

const HOTSPOTS: { lon: number; lat: number; level: 0 | 1 | 2 }[] = [
  { lon: -100, lat: 40, level: 0 },
  { lon: -47, lat: -15, level: 1 },
  { lon: 10, lat: 50, level: 0 },
  { lon: 38, lat: 8, level: 2 },
  { lon: 78, lat: 22, level: 1 },
  { lon: 116, lat: 36, level: 0 },
  { lon: 135, lat: -25, level: 2 },
  { lon: 30, lat: 60, level: 1 },
];
const ARCS: [number, number][] = [
  [0, 2],
  [2, 5],
  [1, 3],
  [4, 6],
  [7, 0],
];

export const ThreatMap: React.FC<{ f: number; w: number; h: number; theme: Theme }> = ({ f, w, h, theme }) => {
  const colors = [theme.red, theme.yellow, theme.accent];
  const dot = Math.max(3, w / 300);
  return (
    <svg width={w} height={h} style={{ position: "absolute", overflow: "visible" }}>
      {WORLD_DOTS.map(([x, y], i) => (
        <circle key={i} cx={x * w} cy={y * h} r={dot} fill={theme.accent} opacity={0.38 + 0.2 * hash01(i, 5)} />
      ))}
      {ARCS.map(([a, b], i) => {
        const [ax, ay] = project(HOTSPOTS[a].lon, HOTSPOTS[a].lat);
        const [bx, by] = project(HOTSPOTS[b].lon, HOTSPOTS[b].lat);
        const x1 = ax * w;
        const y1 = ay * h;
        const x2 = bx * w;
        const y2 = by * h;
        const mx = (x1 + x2) / 2;
        const my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.35 - 40;
        const s = loopSaw(f, 3, i * 0.21); // 3 trips per loop
        const q = (p0: number, p1: number, p2: number) => (1 - s) * (1 - s) * p0 + 2 * (1 - s) * s * p1 + s * s * p2;
        return (
          <g key={i}>
            <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke={theme.yellow} strokeOpacity={0.55} strokeWidth={3} strokeDasharray="10 8" />
            <circle cx={q(x1, mx, x2)} cy={q(y1, my, y2)} r={dot * 2.2} fill={theme.yellow} style={{ filter: `drop-shadow(0 0 8px ${theme.yellow})` }} />
          </g>
        );
      })}
      {HOTSPOTS.map((p, i) => {
        const [x, y] = project(p.lon, p.lat);
        const blink = 0.5 + 0.5 * loopSin(f, 10 + (i % 3) * 5, i * 1.3); // whole cycles
        const ring = loopSaw(f, 5, i * 0.17);
        return (
          <g key={i}>
            <circle cx={x * w} cy={y * h} r={dot * (2 + ring * 7)} fill="none" stroke={colors[p.level]} strokeWidth={3} opacity={1 - ring} />
            <circle cx={x * w} cy={y * h} r={dot * 2.4} fill={colors[p.level]} opacity={0.4 + 0.6 * blink} style={{ filter: `drop-shadow(0 0 10px ${colors[p.level]})` }} />
          </g>
        );
      })}
    </svg>
  );
};

/* ───────────────────────── Fingerprint ───────────────────────── */

const FINGER_PATHS: string[] = (() => {
  const rnd = mulberry32(4242);
  const paths: string[] = [];
  // nested elliptical ridges, open at the bottom, broken into segments
  for (let i = 0; i < 13; i++) {
    const rx = 14 + i * 6.4;
    const ry = 20 + i * 8.2;
    const cx = 100;
    const cy = 118 - i * 1.2;
    const start = Math.PI * (0.92 - i * 0.012);
    const end = Math.PI * (2.08 + i * 0.012);
    let a = start;
    while (a < end) {
      const len = 0.35 + rnd() * 1.1;
      const b = Math.min(end, a + len);
      const steps = 14;
      const pts: string[] = [];
      for (let s = 0; s <= steps; s++) {
        const th = a + ((b - a) * s) / steps;
        const wob = 1 + 0.04 * Math.sin(th * 3 + i);
        pts.push(`${(cx + Math.cos(th) * rx * wob).toFixed(1)} ${(cy + Math.sin(th) * ry).toFixed(1)}`);
      }
      paths.push(`M ${pts.join(" L ")}`);
      a = b + 0.08 + rnd() * 0.18;
    }
  }
  // a few lower loops
  for (let i = 0; i < 5; i++) {
    const y = 170 + i * 12;
    paths.push(`M ${40 + i * 6} ${y} Q 100 ${y - 30 + i * 4} ${160 - i * 6} ${y}`);
  }
  return paths;
})();

export const Fingerprint: React.FC<{ f: number; size: number; color: string }> = ({ f, size, color }) => {
  const scan = loopSaw(f, 5); // 5 sweeps per loop (ping-pong)
  const y = 20 + (scan < 0.5 ? scan * 2 : 2 - scan * 2) * 200;
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 200 240" style={{ overflow: "visible" }}>
      <defs>
        <clipPath id="fp-clip">
          <rect x={0} y={0} width={200} height={y} />
        </clipPath>
      </defs>
      <g fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.45}>
        {FINGER_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill="none" stroke={color} strokeWidth={4.5} strokeLinecap="round" clipPath="url(#fp-clip)" style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
        {FINGER_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <rect x={-10} y={y - 2} width={220} height={4} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      <rect x={-10} y={y - 30} width={220} height={28} fill={withAlpha(color, 0.12)} />
    </svg>
  );
};

/* ───────────────────────── Event log ───────────────────────── */

export type LogLine = { time: string; level: "INFO" | "WARN" | "ALERT"; msg: string };

/**
 * Scrolls exactly ONE block of lines per loop, then repeats.
 * Each line steps in with a short eased slide.
 */
export const EventLog: React.FC<{
  f: number;
  lines: LogLine[];
  visible: number;
  lineH: number;
  w: number;
  theme: Theme;
  size?: number;
}> = ({ f, lines, visible, lineH, w, theme, size = 40 }) => {
  const n = lines.length;
  const pos = loopT(f) * n;
  const i = Math.floor(pos);
  const fr = pos - i;
  const offset = i + smoothstep(0.82, 1, fr);
  const colors = { INFO: theme.green, WARN: theme.yellow, ALERT: theme.red };
  const rows = [];
  for (let k = -1; k <= visible + 1; k++) {
    const idx = Math.floor(offset) + k;
    const line = lines[((idx % n) + n) % n];
    const yy = (k - (offset - Math.floor(offset))) * lineH;
    const fade = Math.min(1, Math.max(0, Math.min(yy / lineH + 1, visible - yy / lineH)));
    rows.push(
      <div key={idx} style={{ position: "absolute", top: yy, left: 0, width: w, display: "flex", gap: 36, fontFamily: MONO, fontSize: size, opacity: fade, whiteSpace: "nowrap" }}>
        <span style={{ color: theme.dim }}>{line.time}</span>
        <span style={{ color: colors[line.level], width: size * 3.2, fontWeight: 700, textShadow: `0 0 10px ${colors[line.level]}` }}>{line.level}</span>
        <span style={{ color: theme.text }}>{line.msg}</span>
      </div>,
    );
  }
  return <div style={{ position: "relative", width: w, height: visible * lineH, overflow: "hidden" }}>{rows}</div>;
};

/** "VPN Connected" + animated ellipsis; whole cycles per loop. */
export const dotsAt = (f: number, cycles = 20) => ".".repeat(Math.floor(loopSaw(f, cycles) * 4));

/** Blink on/off with an integer number of cycles per loop. */
export const blink = (f: number, cycles: number) => (loopSaw(f, cycles) < 0.5 ? 1 : 0.25);

export const LOOP_FRAMES = LOOP;
