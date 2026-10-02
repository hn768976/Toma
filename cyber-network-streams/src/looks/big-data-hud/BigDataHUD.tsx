import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { INTER, MONO } from "../../lib/fonts";
import { ICONS } from "../../lib/icons";
import { mulberry32 } from "../../lib/random";
import { FontGate } from "../../lib/ui/FontGate";
import { BigDataHudVersion } from "../../versions";
import { Dot, loadWorldDots } from "./worldDots";

// Look 6 — Big Data HUD (20 s loop, on black). Layout in a 1920×1080 SVG
// viewBox scaled to the 3840×2160 frame; dense bar charts on Canvas 2D.
// Every value is periodic over 600 frames (whole-number cycles); counters
// step through a fixed 40-entry sequence that wraps.

export const HUD_DURATION = 600;
const TAU = Math.PI * 2;
const VB_W = 1920;
const VB_H = 1080;
const SCALE = 2; // viewBox → composition px

// ---- module-level fixed data
const R = mulberry32(0xb16da7a);
const SEQ = 40; // counter sequence length (600 / 15)
const counters = Array.from({ length: 24 }, () => Array.from({ length: SEQ }, () => Math.floor(R() * 1e9)));
const phases = Array.from({ length: 400 }, () => R());
const mapBlinks = Array.from({ length: 14 }, () => ({ lon: -170 + R() * 340, lat: -45 + R() * 110, ph: R(), k: 1 + Math.floor(R() * 3) }));
const tableNums = Array.from({ length: 60 }, () => Math.floor(R() * 99999));

type Ctx = { t: number; f: number; P: string[]; text: string; dim: string };
const osc = (t: number, k: number, ph: number) => 0.5 + 0.5 * Math.sin(TAU * (k * t + ph));
const step = (f: number, every = 15) => Math.floor((((f % HUD_DURATION) + HUD_DURATION) % HUD_DURATION) / every) % SEQ;
const pad = (n: number, d: number) => String(Math.floor(n) % 10 ** d).padStart(d, "0");

const T: React.FC<{ x: number; y: number; s?: number; c?: string; mono?: boolean; w?: number; anchor?: "start" | "middle" | "end"; children: React.ReactNode; ls?: number }> = ({ x, y, s = 11, c = "#fff", mono, w = 400, anchor = "start", children, ls = 0 }) => (
  <text x={x} y={y} fontSize={s} fill={c} fontFamily={mono ? MONO : INTER} fontWeight={w} textAnchor={anchor} letterSpacing={ls}>
    {children}
  </text>
);

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
  const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p0[0]},${p0[1]} A${r},${r} 0 ${large} 1 ${p1[0]},${p1[1]}`;
};

const Ring: React.FC<{ cx: number; cy: number; r: number; w: number; pct: number; col: string; label?: boolean; track?: string; textSize?: number }> = ({ cx, cy, r, w, pct, col, label, track = "#2a2a2a", textSize }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={w} />
    <path d={arcPath(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.001, Math.min(0.999, pct)))} fill="none" stroke={col} strokeWidth={w} />
    {label && (
      <T x={cx} y={cy + (textSize ?? r * 0.42) * 0.36} s={textSize ?? r * 0.42} anchor="middle" mono w={500}>
        {Math.round(pct * 100)}%
      </T>
    )}
  </g>
);

const Icon: React.FC<{ name: string; x: number; y: number; s: number; c: string; sw?: number }> = ({ name, x, y, s, c, sw = 2 }) => (
  <g transform={`translate(${x - s / 2},${y - s / 2}) scale(${s / 24})`}>
    <path d={ICONS[name].d} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

// ---------------- widgets
const TopRings: React.FC<Ctx & { x: number; y: number }> = ({ x, y, t, P }) => (
  <g>
    {[0, 1, 2].map((i) => {
      const cx = x + 30 + i * 92;
      const pct = 0.3 + 0.6 * osc(t, 1 + i, phases[i]);
      return (
        <g key={i}>
          <Ring cx={cx} cy={y + 30} r={20} w={4} pct={pct} col={[P[0], P[6], P[0]][i]} />
          <circle cx={cx} cy={y + 30} r={11} fill="none" stroke={[P[6], P[7], P[7]][i]} strokeWidth={2} />
          <rect x={cx - 26} y={y + 64} width={52} height={20} fill={[P[0], P[3], P[4]][i]} rx={2} />
          <Icon name={["lock", "shield", "globe"][i]} x={cx} y={y + 74} s={14} c="#fff" />
        </g>
      );
    })}
  </g>
);

const MeshBlob: React.FC<Ctx & { cx: number; cy: number; r: number }> = ({ cx, cy, r, t }) => {
  const dots: React.ReactNode[] = [];
  const rings = 16;
  for (let k = 1; k <= rings; k++) {
    const kr = k / rings;
    const n = 14 + k * 5;
    const ph = phases[300 + k] * TAU;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + TAU * t * (k % 2 ? 1 : -1) * 0.5;
      const wob = 1 + 0.13 * Math.sin(5 * a + ph + TAU * t * 2) + 0.06 * Math.sin(9 * a - ph);
      const rr = r * kr * wob;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.92;
      const lum = 0.35 + 0.65 * (1 - kr) + 0.2 * Math.sin(a * 3 + ph);
      dots.push(<circle key={`${k}_${j}`} cx={x} cy={y} r={0.9} fill="#d8d8d8" opacity={Math.max(0.15, Math.min(1, lum))} />);
    }
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 0.22} fill="#ffffff" opacity={0.18} />
      {dots}
    </g>
  );
};

const LegendRows: React.FC<Ctx & { x: number; y: number; n: number; w: number }> = ({ x, y, n, w, t, P, dim }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const v = 0.25 + 0.75 * osc(t, 1 + (i % 3), phases[20 + i]);
      return (
        <g key={i}>
          <circle cx={x + 4} cy={y + i * 16 - 3} r={3} fill={P[(i * 3) % 8]} />
          <T x={x + 12} y={y + i * 16} s={8} c={dim} mono>
            {pad(tableNums[i], 5)}
          </T>
          <rect x={x + 50} y={y + i * 16 - 6} width={w * v} height={6} fill={P[(i * 3 + 1) % 8]} />
          <rect x={x + 50 + w * v + 3} y={y + i * 16 - 6} width={w * 0.25 * (1 - v)} height={6} fill={P[(i * 3 + 5) % 8]} />
        </g>
      );
    })}
  </g>
);

const PillCounters: React.FC<Ctx & { x: number; y: number }> = ({ x, y, f, P }) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i}>
        <T x={x + i * 58} y={y} s={10} mono>
          {pad(counters[i][step(f)], 4)}
        </T>
        <rect x={x + i * 58} y={y + 6} width={44} height={6} rx={3} fill={P[[0, 1, 4, 6, 5][i]]} />
      </g>
    ))}
  </g>
);

const NumTable: React.FC<Ctx & { x: number; y: number; rows: number; cols: number; seed: number }> = ({ x, y, rows, cols, seed, f, dim }) => {
  const s = step(f, 30);
  return (
    <g>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <T key={`${r}_${c}`} x={x + c * 52} y={y + r * 15} s={9} c={r === 0 ? "#fff" : dim} mono>
            {pad(counters[(seed + r * cols + c) % 24][(s + r) % SEQ] / 1e4, 5)}
          </T>
        )),
      )}
    </g>
  );
};

const HBars: React.FC<Ctx & { x: number; y: number; n: number; w: number; h: number; gap: number; seed: number }> = ({ x, y, n, w, h, gap, seed, t, P }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const v = 0.35 + 0.65 * osc(t, 1 + ((i + seed) % 3), phases[40 + i + seed]);
      return <rect key={i} x={x} y={y + i * (h + gap)} width={w * v} height={h} fill={P[(i + seed) % 8]} />;
    })}
  </g>
);

const Pills: React.FC<Ctx & { x: number; y: number; seed: number }> = ({ x, y, seed, t, P }) => (
  <g>
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const v = 0.3 + 0.7 * osc(t, 1 + (i % 2), phases[60 + i + seed]);
      const H = 54;
      const col = P[[0, 1, 3, 6, 7, 4][i]];
      return (
        <g key={i}>
          <rect x={x + i * 28} y={y + H * (1 - v) * 0.5} width={18} height={H - H * (1 - v) * 0.5} rx={9} fill={col} />
          <circle cx={x + i * 28 + 9} cy={y + H * (1 - v) * 0.5 + 9} r={6} fill="#fff" />
        </g>
      );
    })}
  </g>
);

const SmallRings: React.FC<Ctx & { x: number; y: number; n: number; seed: number; r?: number }> = ({ x, y, n, seed, t, P, r = 15 }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const a = TAU * (t * (1 + (i % 2)) + phases[80 + i + seed]);
      const cx = x + i * (r * 2 + 12) + r,
        cy = y;
      return (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={P[(i + seed) % 8]} strokeWidth={6} />
          <path d={arcPath(cx, cy, r, a, a + 1.4)} fill="none" stroke={P[(i + seed + 3) % 8]} strokeWidth={6} />
          <path d={arcPath(cx, cy, r, a + 2.6, a + 3.4)} fill="none" stroke={P[(i + seed + 5) % 8]} strokeWidth={6} />
        </g>
      );
    })}
  </g>
);

const WorldMap: React.FC<Ctx & { x: number; y: number; w: number; h: number; dots: Dot[]; r: number; col: string }> = ({ x, y, w, h, dots, t, P, r, col }) => {
  const px = (lon: number) => x + ((lon + 180) / 360) * w;
  const py = (lat: number) => y + ((80 - lat) / 138) * h;
  return (
    <g>
      {dots.map((d, i) => (
        <circle key={i} cx={px(d.lon)} cy={py(d.lat)} r={r} fill={col} />
      ))}
      {mapBlinks.map((b, i) => {
        const on = osc(t, b.k * 2, b.ph);
        return (
          <g key={`b${i}`}>
            <circle cx={px(b.lon)} cy={py(b.lat)} r={r * 1.6 + on * r * 1.6} fill="none" stroke={P[[0, 6, 4][i % 3]]} strokeOpacity={on} strokeWidth={0.8} />
            <circle cx={px(b.lon)} cy={py(b.lat)} r={r * 1.1} fill={P[[0, 6, 4][i % 3]]} opacity={0.4 + 0.6 * on} />
          </g>
        );
      })}
    </g>
  );
};

const BigDonut: React.FC<Ctx & { cx: number; cy: number }> = ({ cx, cy, t, P }) => {
  const segs = [P[0], P[1], P[3], P[4], P[5]];
  const rot = TAU * t; // one turn per loop
  const weights = segs.map((_, i) => 0.6 + 0.4 * osc(t, 1, phases[100 + i]));
  const total = weights.reduce((a, b) => a + b, 0);
  let a = rot - Math.PI / 2;
  return (
    <g>
      {segs.map((c, i) => {
        const span = (weights[i] / total) * TAU;
        const p = <path key={i} d={arcPath(cx, cy, 86, a + 0.012, a + span - 0.012)} fill="none" stroke={c} strokeWidth={38} />;
        a += span;
        return p;
      })}
      <circle cx={cx} cy={cy} r={54} fill="none" stroke={P[4]} strokeWidth={5} />
      <path d={arcPath(cx, cy, 46, -rot * 2, -rot * 2 + 4.2)} fill="none" stroke={P[0]} strokeWidth={4} />
      <path d={arcPath(cx, cy, 46, -rot * 2 + 4.5, -rot * 2 + 5.6)} fill="none" stroke={P[2]} strokeWidth={4} />
      <circle cx={cx} cy={cy} r={31} fill="none" stroke="#333" strokeWidth={1} />
    </g>
  );
};

const LineChart: React.FC<Ctx & { x: number; y: number; w: number; h: number; col: string; seed: number; grid?: boolean; n?: number }> = ({ x, y, w, h, col, seed, t, grid, n = 12 }) => {
  const pts = Array.from({ length: n }, (_, i) => {
    const v = 0.15 + 0.7 * osc(t, 1 + (i % 3), phases[120 + i + seed]);
    return [x + (i / (n - 1)) * w, y + h - v * h];
  });
  // draw-on: the visible portion sweeps across once per loop with a hold
  const k = Math.min(1, ((t * 2 + 0.55) % 1) / 0.6);
  const vis = Math.max(2, Math.ceil(k * n));
  return (
    <g>
      {grid && (
        <g>
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`h${i}`} x1={x} x2={x + w} y1={y + (i / 5) * h} y2={y + (i / 5) * h} stroke="#3a3a3a" strokeWidth={0.6} />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} y1={y} y2={y + h} x1={x + (i / 8) * w} x2={x + (i / 8) * w} stroke="#3a3a3a" strokeWidth={0.6} />
          ))}
        </g>
      )}
      {grid &&
        Array.from({ length: 6 }, (_, i) => (
          <text key={`yl${i}`} x={x - 6} y={y + (i / 5) * h + 3} fontSize={7} fill="#8a8f99" fontFamily={MONO} textAnchor="end">
            {String(500 - i * 100).padStart(3, "0")}
          </text>
        ))}
      <polyline points={pts.slice(0, vis).map((p) => p.join(",")).join(" ")} fill="none" stroke={col} strokeWidth={2} />
      {pts.slice(0, vis).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={col} />
      ))}
    </g>
  );
};

const AreaChart: React.FC<Ctx & { x: number; y: number; w: number; h: number; col: string }> = ({ x, y, w, h, col, t }) => {
  const n = 140;
  const pts = Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1);
    const v = 0.5 + 0.08 * Math.sin(TAU * (u * 3 + t * 2)) + 0.1 * Math.sin(TAU * (u * 11 - t * 3) + 1) + 0.12 * Math.sin(TAU * (u * 29 + t * 5)) + 0.08 * Math.sin(TAU * (u * 47 - t * 7) + 2);
    return `${x + u * w},${y + h - v * h}`;
  });
  return (
    <g>
      <defs>
        <linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity={1} />
          <stop offset="1" stopColor={col} stopOpacity={0.8} />
        </linearGradient>
      </defs>
      <polygon points={`${x},${y + h} ${pts.join(" ")} ${x + w},${y + h}`} fill="url(#areaG)" />
      <polyline points={pts.join(" ")} fill="none" stroke={col} strokeWidth={1.5} />
    </g>
  );
};

const Spirals: React.FC<Ctx & { cx: number; cy: number }> = ({ cx, cy, t, P }) => (
  <g>
    {[0, 1].map((k) => {
      const c = [P[1], P[6]][k];
      const y0 = cy + k * 92;
      return (
        <g key={k}>
          {[36, 27, 18].map((r, i) => {
            const a = TAU * (t * (k ? -1 : 1) * (i + 1)) + i;
            return <path key={i} d={arcPath(cx, y0, r, a, a + 4.6 - i * 0.6)} fill="none" stroke={c} strokeWidth={6} />;
          })}
        </g>
      );
    })}
  </g>
);

const CrossBox: React.FC<{ x: number; y: number; s: number; t: number }> = ({ x, y, s, t }) => {
  const c = 10;
  const pulse = 0.6 + 0.4 * osc(t, 4, 0.2);
  const st = { stroke: "#fff", strokeWidth: 1.5, fill: "none", strokeOpacity: 0.85 };
  return (
    <g>
      <path d={`M${x},${y + c}V${y}H${x + c} M${x + s - c},${y}H${x + s}V${y + c} M${x + s},${y + s - c}V${y + s}H${x + s - c} M${x + c},${y + s}H${x}V${y + s - c}`} {...st} />
      <path d={`M${x + s / 2 - 12},${y + s / 2}H${x + s / 2 + 12} M${x + s / 2},${y + s / 2 - 12}V${y + s / 2 + 12}`} {...st} strokeOpacity={pulse} strokeWidth={2} />
    </g>
  );
};

const TreeList: React.FC<Ctx & { x: number; y: number }> = ({ x, y, f, P, dim }) => (
  <g>
    <line x1={x} x2={x} y1={y} y2={y + 120} stroke={P[4]} strokeWidth={1} />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <circle cx={x} cy={y + 20 + i * 44} r={3} fill={P[4]} />
        <line x1={x} x2={x + 22} y1={y + 20 + i * 44} y2={y + 20 + i * 44} stroke={P[4]} strokeWidth={1} />
        <T x={x + 30} y={y + 24 + i * 44} s={11} mono c="#fff">
          {pad(counters[10 + i][step(f)], 4)} {pad(counters[13 + i][step(f)], 2)} {pad(counters[16 + i][step(f)] / 7, 3)} {pad(counters[19 + i][step(f)], 9)}
        </T>
        <T x={x + 30} y={y + 37 + i * 44} s={8} mono c={dim}>
          {pad(tableNums[30 + i], 5)} {pad(tableNums[33 + i], 5)} {pad(tableNums[36 + i], 5)}
        </T>
      </g>
    ))}
  </g>
);

const ProgressRows: React.FC<Ctx & { x: number; y: number; w: number; n: number; seed: number }> = ({ x, y, w, n, seed, t, P, dim }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const v = 0.45 + 0.55 * osc(t, 1 + (i % 2), phases[160 + i + seed]);
      return (
        <g key={i}>
          <rect x={x} y={y + i * 20} width={6} height={6} fill="#2DE0C0" />
          <T x={x + 12} y={y + i * 20 + 6} s={9} mono>
            {pad(counters[(i + seed) % 24][0] / 1000, 3)} {pad(counters[(i + seed + 1) % 24][0] / 10, 7)} {pad(counters[(i + seed + 2) % 24][0] / 10, 7)} {pad(tableNums[i + seed], 2)}
          </T>
          <rect x={x} y={y + i * 20 + 10} width={w} height={3} fill="#1d3b3b" />
          <rect x={x} y={y + i * 20 + 10} width={w * v} height={3} fill="#2DE0C0" />
          <rect x={x + w + 6} y={y + i * 20 + 7} width={5} height={8} fill={i % 2 ? P[1] : P[2]} />
          <T x={x + w + 16} y={y + i * 20 + 14} s={7} c={dim} mono>
            {pad(tableNums[40 + i], 4)}
          </T>
        </g>
      );
    })}
  </g>
);

// ---------------- canvas bar charts (dense)
type BarSpec = { x: number; y: number; w: number; h: number; draw: (c: CanvasRenderingContext2D, w: number, h: number, t: number, P: string[]) => void };
const BAR_SPECS: BarSpec[] = [
  // col 3 top: big blue bars
  {
    x: 838,
    y: 50,
    w: 420,
    h: 200,
    draw: (c, w, h, t, P) => {
      const n = 16;
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const v = 0.5 + 0.35 * osc(t, 1 + (i % 3), phases[200 + i]);
        c.fillStyle = "#0b1633";
        c.fillRect(i * bw + bw * 0.18, h * 0.08, bw * 0.64, h * 0.92);
        const g = c.createLinearGradient(0, h, 0, h - v * h);
        g.addColorStop(0, "#14306e");
        g.addColorStop(1, P[5]);
        c.fillStyle = g;
        c.fillRect(i * bw + bw * 0.18, h - v * h, bw * 0.64, v * h);
      }
    },
  },
  // col 3 top lower: grey bars under the line chart
  {
    x: 838,
    y: 320,
    w: 420,
    h: 190,
    draw: (c, w, h, t) => {
      const n = 12;
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const v = 0.3 + 0.6 * osc(t, 1 + (i % 2), phases[230 + i]);
        c.fillStyle = i % 3 === 1 ? "#2c2c2c" : "#232323";
        c.fillRect(i * bw + bw * 0.15, h - v * h, bw * 0.7, v * h);
      }
    },
  },
  // col 2 bottom: purple → pink dense bars
  {
    x: 370,
    y: 830,
    w: 400,
    h: 230,
    draw: (c, w, h, t, P) => {
      const n = 16;
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const v = 0.25 + 0.6 * osc(t, 1 + (i % 4 === 0 ? 2 : 1), phases[250 + i]);
        c.globalAlpha = 1;
        c.fillStyle = i < n / 2 ? "#1c0814" : "#070d24";
        c.fillRect(i * bw + bw * 0.15, h * 0.15, bw * 0.7, h * 0.85);
        const g = c.createLinearGradient(0, h, 0, 0);
        const left = i < n / 2;
        g.addColorStop(0, left ? "#3a0e2a" : "#0b1a4a");
        g.addColorStop(1, left ? P[6] : P[5]);
        c.fillStyle = g;
        c.globalAlpha = 0.55 + 0.45 * osc(t, 2, phases[280 + i]);
        c.fillRect(i * bw + bw * 0.15, h - v * h, bw * 0.7, v * h);
      }
      c.globalAlpha = 1;
    },
  },
  // col 1 bottom: multicolour bars
  {
    x: 30,
    y: 880,
    w: 250,
    h: 100,
    draw: (c, w, h, t, P) => {
      const n = 8;
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const v = 0.25 + 0.7 * osc(t, 1 + (i % 2), phases[310 + i]);
        c.fillStyle = P[i % 8];
        c.fillRect(i * bw + bw * 0.3, h - v * h, bw * 0.4, v * h);
      }
    },
  },
  // col 2 top: violet/pink multi bars with year labels region
  {
    x: 370,
    y: 400,
    w: 220,
    h: 100,
    draw: (c, w, h, t, P) => {
      const n = 16;
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const v = 0.2 + 0.75 * osc(t, 1 + (i % 3), phases[330 + i]);
        c.fillStyle = P[[7, 6, 5, 4][i % 4]];
        c.fillRect(i * bw + bw * 0.25, h - v * h, bw * 0.5, v * h);
      }
    },
  },
];

const BarCanvas: React.FC<{ spec: BarSpec; t: number; P: string[] }> = ({ spec, t, P }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const W = Math.round(spec.w * SCALE * dpr),
    H = Math.round(spec.h * SCALE * dpr);
  useLayoutEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.scale(W / spec.w, H / spec.h);
    spec.draw(c, spec.w, spec.h, t, P);
  }, [t, W, H, spec, P]);
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: spec.x * SCALE, top: spec.y * SCALE, width: spec.w * SCALE, height: spec.h * SCALE }} />;
};

const HUD: React.FC<{ version: BigDataHudVersion }> = ({ version }) => {
  const frame = useCurrentFrame();
  const f = ((frame % HUD_DURATION) + HUD_DURATION) % HUD_DURATION;
  const t = f / HUD_DURATION;
  const P = version.palette;
  const [dots, setDots] = useState<Dot[] | null>(null);
  const [h] = useState(() => delayRender("world dots"));
  useEffect(() => {
    loadWorldDots(3).then((d) => {
      setDots(d);
      continueRender(h);
    });
  }, [h]);
  const ctx: Ctx = { t, f, P, text: version.text, dim: version.dim };
  const smallDots = useMemo(() => (dots ? dots.filter((_, i) => i % 2 === 0) : []), [dots]);
  if (!dots) return null;
  const s = step(f);
  const layer = (
    <>
        {/* dividers */}
        <g stroke="#1a1a1a" strokeWidth={1}>
          <line x1={342} x2={342} y1={10} y2={1070} />
          <line x1={822} x2={822} y1={10} y2={1070} />
          <line x1={1318} x2={1318} y1={10} y2={1070} />
          <line x1={10} x2={1910} y1={532} y2={532} />
        </g>
        {/* ---- column 1, top */}
        <TopRings {...ctx} x={20} y={14} />
        <MeshBlob {...ctx} cx={150} cy={230} r={82} />
        <LegendRows {...ctx} x={30} y={360} n={6} w={110} />
        <PillCounters {...ctx} x={30} y={480} />
        {/* ---- column 2, top */}
        <NumTable {...ctx} x={360} y={40} rows={7} cols={3} seed={2} />
        {[0, 1].map((k) => (
          <T key={`dl${k}`} x={545} y={[180, 274][k]} s={7} mono c={version.dim}>
            {pad(tableNums[11 + k], 5)} {pad(tableNums[13 + k], 5)} {pad(tableNums[15 + k], 5)} {pad(tableNums[17 + k], 5)}
          </T>
        ))}
        <HBars {...ctx} x={540} y={30} n={8} w={220} h={9} gap={6} seed={0} />
        <Pills {...ctx} x={365} y={170} seed={0} />
        <SmallRings {...ctx} x={545} y={198} n={5} seed={1} r={13} />
        <SmallRings {...ctx} x={365} y={290} n={4} seed={3} r={15} />
        <HBars {...ctx} x={580} y={272} n={6} w={170} h={6} gap={7} seed={4} />
        <T x={365} y={345} s={11} mono>
          {pad(counters[3][s], 7)} 02
        </T>
        <T x={365} y={362} s={8} mono c={version.dim}>
          {pad(counters[4][s], 9)} 31
        </T>
        {["2025", "2026", "2027", "2028", "2029"].map((y, i) => (
          <g key={y}>
            <path d={`M${370 + i * 44},505 h36 l6,7 l-6,7 h-36 l6,-7 Z`} fill={P[[5, 7, 1, 7, 5][i]]} />
            <T x={390 + i * 44} y={516} s={9} anchor="middle" w={600}>
              {y}
            </T>
          </g>
        ))}
        <rect x={610} y={390} width={160} height={110} fill="#141414" />
        <WorldMap {...ctx} x={615} y={400} w={150} h={90} dots={smallDots} r={1.0} col="#6f6f6f" />
        {/* ---- column 3, top */}
        <g transform="translate(38,0)">
        <T x={800} y={32} s={11} mono>
          {pad(counters[5][s] / 10, 5)}
        </T>
        <T x={960} y={32} s={11} mono>
          {pad(counters[6][s] / 100, 4)}
        </T>
        <T x={1120} y={32} s={11} mono>
          {pad(counters[7][s] / 100, 4)}
        </T>
        <T x={800} y={44} s={7} mono c={version.dim}>
          {pad(tableNums[1], 5)} {pad(tableNums[2], 5)}
        </T>
        <LineChart {...ctx} x={810} y={300} w={330} h={110} col={P[7]} seed={0} />
        <LineChart {...ctx} x={810} y={330} w={330} h={90} col={P[0]} seed={7} n={8} />
        </g>
        {/* ---- column 4, top */}
        <g transform="translate(58,0)">
        <T x={1270} y={42} s={30} w={500} ls={3}>
          BIG DATA
        </T>
        <T x={1270} y={66} s={11} mono>
          {pad(counters[8][s] / 10, 8)} {pad(counters[9][s] / 1e5, 4)} {pad(counters[11][s] / 100, 7)}
        </T>
        <T x={1270} y={80} s={11} mono>
          {pad(counters[12][s] / 10, 8)} {pad(counters[14][s] / 1e5, 4)} {pad(counters[15][s] / 100, 7)}
        </T>
        <BigDonut {...ctx} cx={1745} cy={140} />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const v = 0.4 + 0.55 * osc(t, 1 + (i % 2), phases[360 + i]);
          const col = P[[5, 7, 1, 7, 5, 3, 0][i]];
          return <rect key={i} x={1275 + i * 42} y={290 - v * 170} width={30} height={v * 170} fill={col} fillOpacity={0.28} stroke={col} strokeWidth={1.4} />;
        })}
        <T x={1620} y={262} s={8} mono c={version.dim}>
          {pad(tableNums[5], 6)} 83 {pad(tableNums[6], 9)}
        </T>
        <T x={1620} y={274} s={8} mono c={version.dim}>
          {pad(tableNums[7], 6)} 24 {pad(tableNums[8], 9)}
        </T>
        <T x={1270} y={350} s={24} w={400} ls={2.5}>
          Data Sector : 7950{" "}
          <tspan fontFamily={MONO} fontSize={20}>
            {pad(counters[0][s] / 1e4, 5)} {pad(counters[1][s] / 1e7, 2)}
          </tspan>
        </T>
        <rect x={1276} y={381} width={8} height={8} fill="none" stroke="#fff" strokeWidth={1} strokeDasharray="2 2" />
        <T x={1292} y={389} s={13} ls={1}>
          ANALYSIS DATA NODE
        </T>
        <rect x={1460} y={378} width={6} height={12} fill={P[1]} opacity={osc(t, 10, 0) > 0.5 ? 1 : 0.2} />
        <ProgressRows {...ctx} x={1350} y={418} w={240} n={4} seed={2} />
        </g>
        {/* ---- column 1, bottom */}
        <defs><linearGradient id="tmG" x1="0" x2="1"><stop offset="0" stopColor={P[5]} /><stop offset="1" stopColor={P[4]} /></linearGradient><linearGradient id="sgG" x1="0" x2="1"><stop offset="0" stopColor={P[6]} /><stop offset="1" stopColor="#ff8ac8" /></linearGradient></defs>
        <rect x={20} y={548} width={120} height={36} fill="url(#tmG)" />
        <T x={28} y={575} s={26} w={500} ls={4}>
          TM
        </T>
        <T x={75} y={562} s={8} mono>
          {pad(counters[2][s], 6)}
        </T>
        <rect x={150} y={548} width={130} height={36} fill="url(#sgG)" />
        <T x={158} y={575} s={26} w={500} ls={4}>
          SG
        </T>
        <T x={205} y={562} s={8} mono>
          {pad(counters[3][s], 5)}
        </T>
        <T x={22} y={597} s={7} mono c={version.dim}>
          {pad(tableNums[10], 6)} DATA SECTOR STATS {pad(tableNums[26], 5)}
        </T>
        <T x={22} y={606} s={7} mono c={version.dim}>
          {pad(counters[5][s], 9)} {pad(tableNums[27], 5)} {pad(tableNums[28], 5)}
        </T>
        <WorldMap {...ctx} x={20} y={612} w={300} h={160} dots={dots} r={1.15} col="#7a7a7a" />
        <LineChart {...ctx} x={40} y={880} w={230} h={80} col={P[2]} seed={20} n={8} />
        {[0.75, 0.85, 0.95].map((p0, i) => {
          const p = p0 + 0.03 * Math.sin(TAU * (t * 2 + i * 0.3));
          return <Ring key={i} cx={58 + i * 92} cy={1028} r={24} w={4} pct={p} col={[P[7], P[1], P[0]][i]} label track="#3a3a3a" textSize={13} />;
        })}
        {/* ---- column 2, bottom */}
        <NumTable {...ctx} x={360} y={562} rows={6} cols={3} seed={9} />
        <HBars {...ctx} x={545} y={552} n={9} w={220} h={9} gap={5} seed={3} />
        <Pills {...ctx} x={365} y={700} seed={3} />
        <SmallRings {...ctx} x={545} y={728} n={5} seed={4} r={13} />
        <T x={370} y={810} s={11} mono>
          {pad(counters[20][s] / 1e4, 5)}
        </T>
        {[0, 1, 2].map((k) => (
          <T key={`cap${k}`} x={370 + k * 145} y={822} s={7} mono c={version.dim}>
            {pad(tableNums[20 + k], 5)} {pad(tableNums[23 + k], 4)}
          </T>
        ))}
        <T x={520} y={810} s={11} mono>
          {pad(counters[21][s] / 1e5, 4)}
        </T>
        <T x={660} y={810} s={11} mono>
          {pad(counters[22][s] / 1e5, 4)}
        </T>
        {/* ---- column 3, bottom */}
        <g transform="translate(38,0)">
        <Spirals {...ctx} cx={850} cy={600} />
        <LineChart {...ctx} x={960} y={570} w={270} h={220} col={P[4]} seed={30} grid n={12} />
        <AreaChart {...ctx} x={800} y={810} w={430} h={90} col={P[6]} />
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i}>
            <rect x={800} y={928 + i * 22} width={430} height={18} fill={i === 0 ? "#3a0f22" : "#0f0f0f"} />
            <circle cx={812} cy={937 + i * 22} r={3} fill={P[6]} opacity={0.4 + 0.6 * osc(t, 3, phases[380 + i])} />
            <T x={825} y={941 + i * 22} s={8} mono c={version.dim}>
              {pad(counters[i][(s + i) % SEQ] / 10, 8)}
            </T>
            <T x={960} y={941 + i * 22} s={8} mono c={version.dim}>
              {pad(counters[i + 6][(s + i) % SEQ], 9)}
            </T>
            <T x={1080} y={941 + i * 22} s={8} mono c={version.dim}>
              {pad(counters[i + 12][(s + i) % SEQ], 9)}
            </T>
          </g>
        ))}
        <T x={800} y={922} s={9} mono>
          {pad(counters[23][s] / 10, 7)}       {pad(counters[22][s], 9)}       {pad(counters[21][s] / 1e4, 5)}
        </T>
        </g>
        {/* ---- column 4, bottom */}
        <g transform="translate(58,0)">
        <T x={1270} y={575} s={26} w={400} ls={3}>
          ANALYSIS DATA NODE: 44
        </T>
        <rect x={1272} y={600} width={14} height={14} fill="none" stroke="#fff" strokeWidth={1.4} strokeDasharray="3 3" />
        <T x={1294} y={614} s={22} w={400} ls={2}>
          Data Sector : 001
        </T>
        <rect x={1520} y={600} width={7} height={15} fill={P[1]} />
        <ProgressRows {...ctx} x={1275} y={640} w={260} n={2} seed={7} />
        <CrossBox x={1640} y={600} s={100} t={t} />
        <rect x={1272} y={735} width={14} height={14} fill="none" stroke="#fff" strokeWidth={1.4} strokeDasharray="3 3" />
        <T x={1294} y={750} s={24} w={500} ls={2.5}>
          BIG DATA:
        </T>
        <T x={1360} y={800} s={34} mono>
          {pad(counters[18][s] / 1e5, 4)}
        </T>
        <T x={1460} y={800} s={18} mono>
          {pad(counters[17][s] / 1e3, 6)}
        </T>
        <TreeList {...ctx} x={1300} y={815} />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <T x={1665} y={770 + i * 52} s={8} mono c="#ddd">
              {pad(tableNums[45 + i], 5)} {pad(counters[i][(s + 3) % SEQ] / 1e3, 6)}
            </T>
            <T x={1665} y={781 + i * 52} s={8} mono c={version.dim}>
              {pad(tableNums[50 + i], 5)} {pad(counters[i + 5][(s + 3) % SEQ] / 1e3, 6)}
            </T>
            <rect x={1665} y={787 + i * 52} width={170} height={4} fill="#163a36" />
            <rect x={1665} y={787 + i * 52} width={170 * (0.3 + 0.7 * osc(t, 1, phases[390 + i]))} height={4} fill="#2DE0C0" />
          </g>
        ))}
        </g>
    </>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <svg width={VB_W * SCALE} height={VB_H * SCALE} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {layer}
      </svg>
      {BAR_SPECS.map((spec, i) => (
        <BarCanvas key={i} spec={spec} t={t} P={P} />
      ))}
      {/* soft phosphor glow: a blurred copy screened on top (black stays black) */}
      <svg width={VB_W * SCALE} height={VB_H * SCALE} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ position: "absolute", left: 0, top: 0, filter: "blur(5px)", opacity: 0.45, mixBlendMode: "screen" }}>
        {layer}
      </svg>
    </AbsoluteFill>
  );
};


export const BigDataHUD: React.FC<{ version: BigDataHudVersion }> = ({ version }) => (
  <FontGate>
    <HUD version={version} />
  </FontGate>
);
