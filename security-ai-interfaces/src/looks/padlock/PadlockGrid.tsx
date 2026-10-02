import React from "react";
import { useCurrentFrame } from "remotion";
import { clamp, cyc, fract, smooth, t01, wave } from "../../lib/loop";
import { mulberry32, rInt, rPick, rRange } from "../../lib/random";
import { GLOW_SOFT, Stage } from "../../lib/Stage";
import { mix, Txt } from "../../lib/ui";

// Look 4: padlock grid. 4A secure (all closed), 4B breach wave.

export type PadTheme = {
  name: "secure" | "breach";
  bgA: string; // gradient start (bottom-left)
  bgB: string; // gradient end (top-right)
  blue: string;
  violet: string;
  bright: string;
  red: string;
  redBright: string;
  grid: string;
  leak: string;
  breach: boolean;
  grain: number;
};

export const PAD_SECURE: PadTheme = {
  name: "secure",
  bgA: "#07082a",
  bgB: "#1a1262",
  blue: "#3d5cff",
  violet: "#8d5cff",
  bright: "#dfe4ff",
  red: "#ff2b48",
  redBright: "#ff9aa8",
  grid: "#5a63ff",
  leak: "#6f63ff",
  breach: false,
  grain: 0.015,
};
export const PAD_BREACH: PadTheme = { ...PAD_SECURE, name: "breach", breach: true };

// ------------------------------------------------------------- grid ---
const CELL = 192;
const COLS = 10;
const ROWS = 6;
const OX = 96;
const OY = 60;
const TWINKLE_CYCLES = [1, 2, 3, 4, 5] as const;

const LOCKS = (() => {
  const r = mulberry32(7001);
  const out: { x: number; y: number; b0: number; hue: number; k: number; p: number; amp: number }[] = [];
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      if (r() < 0.36) continue; // empty cell
      out.push({
        x: OX + i * CELL - (j % 2) * 0,
        y: OY + j * CELL,
        b0: rRange(r, 0.3, 0.95),
        hue: r(),
        k: rPick(r, TWINKLE_CYCLES),
        p: r(),
        amp: rRange(r, 0.15, 0.35),
      });
    }
  return out;
})();

const TAGS = (() => {
  const r = mulberry32(7002);
  const out: { x: number; y: number; text: string; period: number; offset: number; filled: boolean; dim: number }[] = [];
  const used = new Set<string>();
  for (let n = 0; n < 70; n++) {
    // tags sit on the half-cell lattice, between padlocks
    const i = rInt(r, 0, COLS * 2);
    const j = rInt(r, 0, ROWS * 2);
    if (i % 2 === 0 && j % 2 === 0) continue; // padlock position
    const key = `${i},${j}`;
    if (used.has(key) || used.has(`${i - 1},${j}`) || used.has(`${i + 1},${j}`)) continue;
    used.add(key);
    const bits = Array.from({ length: 7 }, () => (r() < 0.5 ? "0" : "1")).join("");
    const period = rPick(r, [120, 150, 200, 300] as const);
    out.push({
      x: OX + (i * CELL) / 2 + rRange(r, -30, 30),
      y: OY + (j * CELL) / 2 + (j % 2 === 0 ? 0 : rRange(r, -20, 20)),
      text: bits,
      period,
      offset: rInt(r, 0, period - 1),
      filled: r() < 0.3,
      dim: rRange(r, 0.35, 1),
    });
  }
  return out;
})();

const SPARKS = (() => {
  const r = mulberry32(7003);
  return Array.from({ length: 40 }, () => ({
    x: OX + rInt(r, 0, COLS * 2) * (CELL / 2) - CELL / 4,
    y: OY + rInt(r, 0, ROWS * 2) * (CELL / 2) - CELL / 4,
    period: rPick(r, [60, 100, 120, 150] as const),
    offset: rInt(r, 0, 59),
  }));
})();

// ---- breach wave -------------------------------------------------------
// u = projection of the position on the wave direction, 0..1 across frame.
const DIR_Y = 0.45;
const U_SPAN = 1920 + DIR_Y * 1080;
const PERIOD_U = 0.8; // spacing between successive fronts (in u)
const WAVES_PER_LOOP = 3; // each lock is hit 3 times per loop (every 200 frames)
const LOCAL_PERIOD = 600 / WAVES_PER_LOOP;
const uOf = (x: number, y: number) => (x + DIR_Y * y) / U_SPAN;
/** Frames since the most recent front passed this point (0..199). Pure function of frame. */
const sinceFront = (f: number, x: number, y: number) =>
  fract(WAVES_PER_LOOP * t01(f) - uOf(x, y) / PERIOD_U) * LOCAL_PERIOD;

const OPEN_END = 62;
const CLOSE_END = 74;
const RED_END = 132;

const lockState = (tau: number) => {
  // shackle: springs open with a little overshoot, holds, then drops back
  let open = 0;
  if (tau < OPEN_END) {
    const t = tau / 3;
    open = 1 - Math.exp(-t * 0.9) * Math.cos(t * 1.6);
  } else if (tau < CLOSE_END) {
    open = 1 - smooth(OPEN_END, CLOSE_END, tau);
  }
  const red = tau < CLOSE_END ? smooth(0, 5, tau) : 1 - smooth(CLOSE_END, RED_END, tau);
  const flash = Math.exp(-tau / 6); // bright hit when the front arrives
  const pre = smooth(LOCAL_PERIOD - 10, LOCAL_PERIOD, tau); // glow just before the front
  return { open: clamp(open, -0.1, 1.15), red: clamp(red), flash: Math.max(flash, pre * 0.6) };
};

// ------------------------------------------------------------ padlock --
const Padlock: React.FC<{ x: number; y: number; color: string; opacity: number; open: number; hole: string }> = ({
  x,
  y,
  color,
  opacity,
  open,
  hole,
}) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <path
      d="M-11 2V-9a11 11 0 0 1 22 0V2"
      fill="none"
      stroke={color}
      strokeWidth={5}
      strokeLinecap="butt"
      transform={open !== 0 ? `translate(0 ${-9 * Math.max(0, open)}) rotate(${-32 * open} -11 2)` : undefined}
    />
    <rect x={-19} y={0} width={38} height={29} rx={4} fill={color} />
    <circle cx={0} cy={11.5} r={3.8} fill={hole} />
    <rect x={-1.7} y={12} width={3.4} height={8.5} rx={1.2} fill={hole} />
  </g>
);

export const PadlockGrid: React.FC<{ th: PadTheme }> = ({ th }) => {
  const f = useCurrentFrame();
  const t = t01(f);
  const leakX = 960 + 620 * wave(f, 1);
  const leak2X = 960 - 420 * wave(f, 2, 0.3);
  const fronts: number[] = [];
  if (th.breach) {
    // fronts where WAVES_PER_LOOP * t - u / PERIOD_U is an integer
    for (let m = -3; m <= 4; m++) {
      const u = PERIOD_U * (WAVES_PER_LOOP * t - m);
      if (u > -0.4 && u < 1.4) fronts.push(u);
    }
  }
  const theta = (Math.atan2(DIR_Y, 1) * 180) / Math.PI;
  const norm = Math.hypot(1, DIR_Y);
  return (
    <Stage bg={th.bgA} grain={th.grain}>
      <defs>
        <linearGradient id="pad-bg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={th.bgA} />
          <stop offset="1" stopColor={th.bgB} />
        </linearGradient>
        <radialGradient id="pad-leak" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={th.leak} stopOpacity={0.55} />
          <stop offset="0.5" stopColor={th.leak} stopOpacity={0.18} />
          <stop offset="1" stopColor={th.leak} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="pad-vig" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000010" stopOpacity={0} />
          <stop offset="1" stopColor="#000010" stopOpacity={0.55} />
        </radialGradient>
        <linearGradient id="pad-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={th.red} stopOpacity={0} />
          <stop offset="0.6" stopColor={th.red} stopOpacity={0.12} />
          <stop offset="0.86" stopColor={th.red} stopOpacity={0.22} />
          <stop offset="1" stopColor={th.red} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#pad-bg)" />
      <ellipse cx={leakX} cy={-60} rx={900} ry={360} fill="url(#pad-leak)" />
      <ellipse cx={leak2X} cy={-20} rx={520} ry={200} fill="url(#pad-leak)" opacity={0.6} />
      {/* faint grid: dashed lines on the half-cell lattice */}
      <g stroke={th.grid} strokeWidth={1} strokeDasharray="3 5">
        {Array.from({ length: COLS * 2 + 2 }, (_, i) => (
          <line key={`v${i}`} x1={OX + ((i - 1) * CELL) / 2} y1={0} x2={OX + ((i - 1) * CELL) / 2} y2={1080} opacity={i % 2 === 1 ? 0.14 : 0.07} />
        ))}
        {Array.from({ length: ROWS * 2 + 2 }, (_, j) => (
          <line key={`h${j}`} x1={0} y1={OY + ((j - 1) * CELL) / 2 + 14} x2={1920} y2={OY + ((j - 1) * CELL) / 2 + 14} opacity={j % 2 === 1 ? 0.14 : 0.07} />
        ))}
      </g>
      {/* red light band trailing each breach front */}
      {fronts.map((u, i) => {
        const s = (u * U_SPAN) / norm;
        const bw = (0.42 * U_SPAN) / norm;
        return (
          <g key={i} transform={`rotate(${theta})`}>
            <rect x={s - bw} y={-1500} width={bw * 1.16} height={4000} fill="url(#pad-band)" />
          </g>
        );
      })}
      {/* sparkle crosses on grid intersections */}
      {SPARKS.map((s, i) => {
        const b = Math.pow(0.5 - 0.5 * Math.cos(Math.PI * 2 * cyc(f, s.period, s.offset)), 4);
        return (
          <path key={i} d={`M${s.x - 5} ${s.y + 14}h10M${s.x} ${s.y + 9}v10`} stroke={th.bright} strokeWidth={1.2} opacity={0.15 + 0.6 * b} />
        );
      })}
      {/* binary tags */}
      {TAGS.map((g, i) => {
        const p = cyc(f, g.period, g.offset);
        const vis = Math.pow(Math.sin(Math.PI * p), 2) * g.dim;
        if (vis < 0.02) return null;
        let col = mix(th.blue, th.bright, 0.35);
        if (th.breach) {
          const r = lockState(sinceFront(f, g.x, g.y)).red;
          col = mix(mix(th.blue, th.bright, 0.35), th.red, r);
        }
        return (
          <g key={i} opacity={vis}>
            <rect x={g.x - 34} y={g.y + 5} width={68} height={18} rx={2} fill={g.filled ? col : "none"} fillOpacity={0.35} stroke={col} strokeWidth={1} />
            <Txt x={g.x} y={g.y + 18} size={10.5} anchor="middle" fill={g.filled ? th.bright : col} mono>
              {g.text}
            </Txt>
          </g>
        );
      })}
      {/* padlocks */}
      <g filter={GLOW_SOFT}>
        {LOCKS.map((l, i) => {
          // calm twinkle + diagonal brightness waves (2 per loop)
          const tw = l.amp * wave(f, l.k, l.p);
          const d = (l.x + l.y) / 3000;
          const wv = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * 2 * (2 * d - 2 * t)), 8);
          let bright = clamp(l.b0 + tw + 0.55 * wv);
          let base = mix(th.blue, th.violet, l.hue);
          let open = 0;
          if (th.breach) {
            const s = lockState(sinceFront(f, l.x, l.y));
            open = s.open;
            bright = clamp(bright * (1 - 0.5 * s.red) + 0.6 * s.red + 0.5 * s.flash);
            base = mix(base, th.red, s.red);
            const c = mix(base, s.red > 0.5 ? th.redBright : th.bright, Math.pow(bright, 2) * 0.55);
            return <Padlock key={i} x={l.x} y={l.y} color={c} opacity={0.3 + 0.7 * bright} open={open} hole={mix(th.bgA, "#2a0010", s.red)} />;
          }
          const c = mix(base, th.bright, Math.pow(bright, 2) * 0.55);
          return <Padlock key={i} x={l.x} y={l.y} color={c} opacity={0.3 + 0.7 * bright} open={0} hole={th.bgA} />;
        })}
      </g>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#pad-vig)" />
    </Stage>
  );
};
