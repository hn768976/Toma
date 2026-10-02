import React from "react";
import { useCurrentFrame } from "remotion";
import { Frame } from "../lib/Frame";
import { GlowFilter } from "../lib/Glow";
import { Grain } from "../lib/Grain";
import { DESIGN_H, DESIGN_W, LOOP_FRAMES, TAU } from "../lib/constants";
import { FONT_DIGITS } from "../lib/fonts";
import { int, mulberry32, range } from "../lib/random";
import { makeLoopWave, wavePath } from "../lib/waveform";
import { qaOff } from "../lib/qa";
import { SIGNAL_COLORS as C } from "./theme";

/*
 * Look 1 — Signal Readout. 600-frame seamless loop.
 * Everything that moves is a function of t = frame % 600.
 */

// ---------- module-level data (generated once, seeded) ----------

const rng = mulberry32(491344648);

type Band = { y: number; h: number; traces: Trace[]; rows: DigitRow[]; hazePhase: number };
type Trace = { samples: Float32Array; visible: number; opacity: number; width: number; scaleY: number; dy: number };
type DigitGroup = { x: number; len: number; dim: boolean; values: string[] };
type DigitRow = { y: number; groups: DigitGroup[] };

const randomDigits = (len: number) => {
  let s = "";
  for (let i = 0; i < len; i++) s += String(int(rng, 0, 9));
  return s;
};

// One string per frame of the loop. Fast groups re-roll every `period`
// frames (a divisor of 600); slow groups hold, then jump at scheduled frames.
const buildSchedule = (len: number, fast: boolean): string[] => {
  const out: string[] = new Array(LOOP_FRAMES);
  if (fast) {
    const period = [2, 3, 4, 5, 6][int(rng, 0, 4)];
    // Only the trailing digits tick, like a counter readout.
    const head = randomDigits(len);
    const tickLen = Math.min(len, int(rng, 2, 5));
    let cur = head;
    for (let f = 0; f < LOOP_FRAMES; f++) {
      if (f % period === 0) cur = head.slice(0, len - tickLen) + randomDigits(tickLen);
      out[f] = cur;
    }
    // Occasionally the whole head changes too.
    return out;
  }
  let cur = randomDigits(len);
  let next = int(rng, 20, 90);
  for (let f = 0; f < LOOP_FRAMES; f++) {
    if (f === next) {
      cur = randomDigits(len);
      next = f + int(rng, 25, 110);
    }
    out[f] = cur;
  }
  return out;
};

const DIGIT_SIZE = 40; // design px
const DIGIT_ADVANCE = DIGIT_SIZE * 0.84; // DSEG7 is fixed-width

const buildRow = (y: number): DigitRow => {
  const groups: DigitGroup[] = [];
  let x = -range(rng, 10, 60);
  let i = 0;
  while (x < DESIGN_W) {
    const len = int(rng, 5, 14);
    // Bright groups on the left, dim ghosts further right (as in the reference).
    const dim = x > DESIGN_W * 0.48 || (i > 0 && rng() < 0.2);
    groups.push({ x, len, dim, values: buildSchedule(len, rng() < 0.5) });
    x += len * DIGIT_ADVANCE + range(rng, 40, 110);
    i++;
  }
  return { y, groups };
};

const buildBand = (y: number, h: number, smooth: boolean): Band => {
  const traces: Trace[] = [];
  const layers = [
    { opacity: 1, width: 1.6 },
    { opacity: 0.7, width: 1.3 },
    { opacity: 0.5, width: 1.1 },
    { opacity: 0.32, width: 1 },
  ];
  layers.forEach((l, k) => {
    const visible = 900 + 90 * k; // samples across the screen
    const n = visible * (k % 2 === 0 ? 2 : 3); // scrolls 2 or 3 screen widths per loop
    const wave = makeLoopWave(rng, {
      n,
      jitter: smooth ? 0.36 : 0.45,
      jitterSmooth: 0,
      jitterEnvelope: [
        { cycles: int(rng, 3, 6), depth: 0.75 },
        { cycles: int(rng, 7, 12), depth: 0.5 },
      ],
      swells: smooth
        ? [
            { cycles: n / visible * 2, amp: range(rng, 0.55, 0.8) },
            { cycles: int(rng, 1, 2), amp: 0.25 },
          ]
        : [{ cycles: int(rng, 3, 6), amp: 0.22 }],
      bursts: smooth
        ? { count: 2, amp: [0.3, 0.5], width: [8, 16], period: [3, 5] }
        : { count: int(rng, 5, 8), amp: [0.5, 0.95], width: [8, 26], period: [2.2, 4] },
      spikes: { count: int(rng, 6, 14), amp: [0.4, 0.9] },
    });
    traces.push({
      samples: wave.samples,
      visible,
      opacity: l.opacity,
      width: l.width,
      scaleY: h * 0.24,
      dy: range(rng, -12, 12),
    });
  });
  return {
    y,
    h,
    traces,
    rows: [buildRow(y + h * 0.2), buildRow(y + h * 0.2 + DIGIT_SIZE * 1.45)],
    hazePhase: rng() * TAU,
  };
};

const BANDS: Band[] = [buildBand(300, 420, true), buildBand(780, 420, false)];

// ---------- rendering ----------

const Grid: React.FC = () => {
  const lines: React.ReactNode[] = [];
  const step = 30;
  for (let x = step / 2; x < DESIGN_W; x += step)
    lines.push(<line key={`v${x}`} x1={x} x2={x} y1={0} y2={DESIGN_H} />);
  for (let y = 0; y < DESIGN_H; y += step) lines.push(<line key={`h${y}`} x1={0} x2={DESIGN_W} y1={y} y2={y} />);
  return (
    <g stroke={C.grid} strokeWidth={1} opacity={0.5}>
      {lines}
    </g>
  );
};

export const SignalReadout: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame % LOOP_FRAMES; // the whole look is a function of t
  const p = t / LOOP_FRAMES; // 0..1 through the loop

  return (
    <Frame background={C.background}>
      <defs>
        <linearGradient id="sr-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.backgroundEdge} />
          <stop offset="0.5" stopColor={C.background} />
          <stop offset="1" stopColor={C.backgroundEdge} />
        </linearGradient>
        {BANDS.map((b, i) => (
          <radialGradient key={i} id={`sr-haze-${i}`} cx="0.5" cy="0.5" r="0.5" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor={C.haze} stopOpacity={0.85} />
            <stop offset="0.4" stopColor={C.haze} stopOpacity={0.42} />
            <stop offset="0.75" stopColor={C.haze} stopOpacity={0.12} />
            <stop offset="1" stopColor={C.haze} stopOpacity={0} />
          </radialGradient>
        ))}
        <linearGradient id="sr-strip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={0} />
          <stop offset="0.5" stopColor="#000" stopOpacity={0.55} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </linearGradient>
        <radialGradient id="sr-vignette" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.75} />
        </radialGradient>
        <GlowFilter id="sr-glow" base={1.5} strength={[1, 0.75, 0.45]} region={{ x: 0, y: 80, width: DESIGN_W, height: 920 }} />
      </defs>

      <rect width={DESIGN_W} height={DESIGN_H} fill="url(#sr-bg)" />

      {/* Haze: breathes 2 and 3 whole cycles per loop */}
      {!qaOff("haze") && BANDS.map((b, i) => {
        const breathe = 0.72 + 0.18 * Math.sin(TAU * 2 * p + b.hazePhase) + 0.1 * Math.sin(TAU * 3 * p + b.hazePhase * 2);
        return (
          <ellipse
            key={i}
            cx={DESIGN_W / 2}
            cy={b.y}
            rx={DESIGN_W * 0.62}
            ry={b.h * 0.62}
            fill={`url(#sr-haze-${i})`}
            opacity={breathe}
          />
        );
      })}

      <Grid />

      {/* Darker horizontal strips between and around the bands */}
      <rect x={0} y={0} width={DESIGN_W} height={70} fill="url(#sr-strip)" />
      <rect x={0} y={505} width={DESIGN_W} height={70} fill="url(#sr-strip)" />
      <rect x={0} y={1010} width={DESIGN_W} height={70} fill="url(#sr-strip)" />
      <g stroke={C.rule} strokeWidth={1}>
        <line x1={0} x2={DESIGN_W} y1={88} y2={88} />
        <line x1={0} x2={DESIGN_W} y1={530} y2={530} />
        <line x1={0} x2={DESIGN_W} y1={550} y2={550} />
        <line x1={0} x2={DESIGN_W} y1={992} y2={992} />
      </g>

      {/* One glow pass for traces and digits together (glow is the costliest part of the frame) */}
      <g filter="url(#sr-glow)">
      {/* Waveform traces: each scrolls exactly its own N samples per loop */}
      <g fill="none" strokeLinejoin="round">
        {!qaOff("waveforms") && BANDS.map((b, bi) =>
          b.traces.map((tr, ti) => (
            <path
              key={`${bi}-${ti}`}
              d={wavePath(tr.samples, tr.samples.length * p, {
                x0: -20,
                x1: DESIGN_W + 20,
                y: b.y - b.h * 0.08 + tr.dy,
                scaleY: tr.scaleY,
                count: tr.visible,
              })}
              stroke={ti === 0 ? C.traceCore : C.trace}
              strokeWidth={tr.width}
              opacity={tr.opacity}
            />
          )),
        )}
      </g>

      {/* Seven-segment readouts */}
      <g fontFamily={FONT_DIGITS} fontWeight={700} fontSize={DIGIT_SIZE}>
        {!qaOff("digits") && BANDS.map((b, bi) =>
          b.rows.map((row, ri) =>
            row.groups.map((g, gi) => (
              <text
                key={`${bi}-${ri}-${gi}`}
                x={g.x}
                y={row.y}
                fill={g.dim ? C.digitDim : C.digit}
                opacity={g.dim ? 0.38 : 1}
              >
                {g.values[t]}
              </text>
            )),
          ),
        )}
      </g>

      </g>

      <rect width={DESIGN_W} height={DESIGN_H} fill="url(#sr-vignette)" />
      <Grain seed={t} amount={0.045} />
    </Frame>
  );
};
