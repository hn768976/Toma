import React from "react";
import { useCurrentFrame } from "remotion";
import { Frame } from "../lib/Frame";
import { GlowFilter } from "../lib/Glow";
import { Grain } from "../lib/Grain";
import { DESIGN_H, DESIGN_W, LOOP_FRAMES, TAU } from "../lib/constants";
import { FONT_UI } from "../lib/fonts";
import { int, mulberry32, range } from "../lib/random";
import { circDist, makeLoopWave, Wave, wavePath } from "../lib/waveform";
import { AUDIO_COLORS as C } from "./theme";
import { qaOff } from "../lib/qa";

/*
 * Look 3 — Audio Editor. 600-frame seamless loop.
 * Everything that moves is a function of t = frame % 600, and every periodic
 * motion completes a whole number of cycles in 600 frames.
 */

const rng = mulberry32(859900812);

// ---------- layout (design px) ----------
const STRIP_X0 = 282;
const STRIP_X1 = 1900;
const STRIP_W = STRIP_X1 - STRIP_X0;
const STRIP_H = 160;
const STRIP_Y = [190, 378, 566, 754];
const LABELS = ["WAV_01", "WAV_02", "WAV_03", "WAV_04"];

// ---------- channel waveforms ----------
type Channel = {
  wave: Wave;
  visible: number;
  burstCycles: number[]; // swell/fade cycles per loop, one per burst
  burstPhase: number[];
  bokeh: { x: number; y: number; r: number; o: number }[];
  specks: { i: number; y: number; o: number }[];
};

const CHANNELS: Channel[] = STRIP_Y.map((_, ci) => {
  const visible = 900;
  const n = visible * 2; // scrolls exactly 2 strip-widths per loop
  const wave = makeLoopWave(rng, {
    n,
    jitter: 0.05,
    jitterSmooth: 0,
    swells: [{ cycles: int(rng, 6, 12), amp: 0.025 }],
    bursts: { count: int(rng, 3, 5), amp: [0.7, 1.05], width: [10, 30], period: [5, 11] },
    spikes: { count: int(rng, 10, 16), amp: [0.25, 0.75] },
  });
  // A long, wide swelling packet on two of the channels (like the reference's WAV_04).
  if (ci % 2 === 1) {
    const c = rng() * n;
    const w = range(rng, 40, 70);
    for (let i = 0; i < n; i++) {
      const d = circDist(i, c, n);
      wave.samples[i] += 0.8 * Math.exp(-((d / w) ** 2)) * Math.sin(d * 0.9);
    }
    wave.bursts.push({ center: c, width: w, amp: 0.75, period: 3, phase: 0 });
  }
  return {
    wave,
    visible,
    burstCycles: wave.bursts.map(() => int(rng, 1, 3)),
    burstPhase: wave.bursts.map(() => rng() * TAU),
    bokeh: Array.from({ length: 34 }, () => ({
      x: rng() * STRIP_W,
      y: range(rng, 0.1, 0.9) * STRIP_H,
      r: range(rng, 4, 26),
      o: range(rng, 0.12, 0.5),
    })),
    specks: Array.from({ length: 140 }, () => ({
      i: int(rng, 0, n - 1),
      y: (rng() * 2 - 1) * range(rng, 0.03, 0.3),
      o: range(rng, 0.3, 1),
    })),
  };
});

// ---------- schedules (one entry per loop frame) ----------
const EQ_COUNT = 15;
// Each indicator jumps to a new level every `period` frames (divisor of 600).
const EQ_LEVELS: number[][] = Array.from({ length: EQ_COUNT }, () => {
  const period = [3, 4, 5, 6][int(rng, 0, 3)];
  const out: number[] = [];
  let v = rng();
  for (let f = 0; f < LOOP_FRAMES; f++) {
    if (f % period === 0) v = Math.min(1, Math.max(0, v + (rng() * 2 - 1) * 0.55));
    out.push(v);
  }
  return out;
});

const LED_COLS = 8;
const LED_ROWS = 4;
// Run-length blink pattern per LED, wrapped onto the 600-frame loop.
const LEDS = Array.from({ length: LED_COLS * LED_ROWS }, () => {
  const red = rng() < 0.45;
  const on: boolean[] = new Array(LOOP_FRAMES);
  let state = rng() < 0.5;
  let f = 0;
  while (f < LOOP_FRAMES) {
    const len = state ? int(rng, 4, 30) : int(rng, 6, 60);
    for (let k = 0; k < len && f < LOOP_FRAMES; k++, f++) on[f] = state;
    state = !state;
  }
  return { red, on };
});

// Faders: sums of sines with whole-number cycles per loop.
const FADERS = Array.from({ length: 4 }, () => ({
  base: range(rng, 0.25, 0.75),
  a: [range(rng, 0.08, 0.16), range(rng, 0.04, 0.09)],
  k: [int(rng, 1, 2), int(rng, 3, 5)],
  ph: [rng() * TAU, rng() * TAU],
}));
const SLIDERS = Array.from({ length: 4 }, () => ({ base: range(rng, 0.2, 0.8), a: range(rng, 0.05, 0.15), k: int(rng, 1, 3), ph: rng() * TAU }));
const DOTS = Array.from({ length: 70 }, () => ({ x: range(rng, 284, 500), y: range(rng, 46, 150), o: range(rng, 0.25, 0.9), k: int(rng, 1, 4), ph: rng() * TAU }));

// ---------- icons (hand-drawn SVG paths, 24x24 box) ----------
const ICONS: string[] = [
  "M5 5h2v14H5z M19 5 9 12l10 7z", // skip to start
  "M12 5 3 12l9 7z M21 5l-9 7 9 7z", // rewind
  "M7 5h2v14H7z M18 5l-8 7 8 7z", // previous
  "M8 5v14l11-7z", // play
  "M12 7a5 5 0 1 0 0.01 0z", // record
  "M6 6h12v12H6z", // stop
  "M7 5h3.5v14H7z M13.5 5H17v14h-3.5z", // pause
  "M6 5l8 7-8 7z M15 5h2v14h-2z", // next
  "M3 5l9 7-9 7z M12 5l9 7-9 7z", // fast forward
  "M5 5l10 7-10 7z M17 5h2v14h-2z", // skip to end
  "M5 10a5 5 0 0 1 5-5h7V2.5L21 6.5l-4 4V8h-7a2 2 0 0 0-2 2v1H5z M19 14a5 5 0 0 1-5 5H7v2.5L3 17.5l4-4V16h7a2 2 0 0 0 2-2v-1h3z", // loop
  "M4 9h4l5-4v14l-5-4H4z M16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2z", // volume
];

// ---------- components ----------
const Label: React.FC<{ x: number; y: number; children: string }> = ({ x, y, children }) => (
  <text x={x} y={y} fontFamily={FONT_UI} fontWeight={500} fontSize={11.5} letterSpacing={0.6} fill={C.label}>
    {children}
  </text>
);

const ChannelStrip: React.FC<{ ch: Channel; y: number; p: number; index: number }> = ({ ch, y, p, index }) => {
  const n = ch.wave.samples.length;
  const offset = n * p; // exactly N samples per loop
  const cy = y + STRIP_H / 2;
  const dx = STRIP_W / (ch.visible - 1);
  // burst packets swell and fade over time (whole cycles per loop)
  const burstGain = ch.wave.bursts.map((_, k) => 0.55 + 0.45 * Math.sin(TAU * ch.burstCycles[k] * p + ch.burstPhase[k]));
  const gain = (idx: number) => {
    let g = 1;
    ch.wave.bursts.forEach((b, k) => {
      const d = circDist(idx, b.center, n);
      const w = Math.exp(-((d / (b.width * 1.6)) ** 2));
      g += w * (burstGain[k] - 1);
    });
    return g;
  };
  const pathOpts = { x0: STRIP_X0, x1: STRIP_X1, y: cy, scaleY: STRIP_H * 0.47, count: ch.visible, gain };
  const d = wavePath(ch.wave.samples, offset, pathOpts);
  // bokeh drifts left by exactly one strip width per loop
  const drift = STRIP_W * p;
  return (
    <g>
      <rect x={STRIP_X0} y={y} width={STRIP_W} height={STRIP_H} fill="url(#ae-strip)" />
      <g clipPath={`url(#ae-clip-${index})`}>
        <g filter="url(#ae-bokeh)" display={qaOff("haze") ? "none" : undefined}>
          {ch.bokeh.map((b, i) => {
            const x = STRIP_X0 + ((((b.x - drift) % STRIP_W) + STRIP_W) % STRIP_W);
            return (
              <React.Fragment key={i}>
                <circle cx={x} cy={y + b.y} r={b.r} fill={C.bokeh} opacity={b.o} />
                <circle cx={x - STRIP_W} cy={y + b.y} r={b.r} fill={C.bokeh} opacity={b.o} />
                <circle cx={x + STRIP_W} cy={y + b.y} r={b.r} fill={C.bokeh} opacity={b.o} />
              </React.Fragment>
            );
          })}
        </g>
        {/* soft horizontal light along the centre */}
        <rect x={STRIP_X0} y={cy - 26} width={STRIP_W} height={52} fill="url(#ae-centre-glow)" />
        <g filter="url(#ae-glow)" fill="none" strokeLinejoin="round" display={qaOff("waveforms") ? "none" : undefined}>
          <path d={d} stroke={C.wave} strokeWidth={2.6} opacity={0.9} />
          <line x1={STRIP_X0} x2={STRIP_X1} y1={cy} y2={cy} stroke={C.wave} strokeWidth={2} opacity={0.9} />
        </g>
        {/* thin bright cores */}
        <path d={d} display={qaOff("waveforms") ? "none" : undefined} stroke={C.core} strokeWidth={1.1} fill="none" strokeLinejoin="round" />
        <line x1={STRIP_X0} x2={STRIP_X1} y1={cy} y2={cy} stroke={C.core} strokeWidth={1} />
        <g fill={C.core} display={qaOff("waveforms") ? "none" : undefined}>
          {ch.specks.map((s, i) => {
            const j = (((s.i - offset) % n) + n) % n;
            if (j > ch.visible) return null;
            return <circle key={i} cx={STRIP_X0 + j * dx} cy={cy + s.y * STRIP_H} r={1.3} opacity={s.o} />;
          })}
        </g>
      </g>
      <rect x={STRIP_X0} y={y} width={STRIP_W} height={STRIP_H} fill="none" stroke={C.panelLine} strokeWidth={1} />
      <rect x={STRIP_X0} y={y - 20} width={92} height={16} fill={C.tab} />
      <Label x={STRIP_X0 + 6} y={y - 7.5}>{LABELS[index]}</Label>
    </g>
  );
};

const LevelMeters: React.FC<{ p: number }> = ({ p }) => {
  const top = 46;
  const bottom = 900;
  const cols = [
    { x: 62, scale: 92, fader: 0 },
    { x: 182, scale: 150, fader: 2 },
  ];
  const faderY = (k: number) => {
    const f = FADERS[k];
    const v = f.base + f.a[0] * Math.sin(TAU * f.k[0] * p + f.ph[0]) + f.a[1] * Math.sin(TAU * f.k[1] * p + f.ph[1]);
    return top + 20 + (bottom - top - 40) * Math.min(1, Math.max(0, v));
  };
  return (
    <g>
      <Label x={20} y={30}>LEVEL_L_R</Label>
      {cols.map((c, ci) => (
        <g key={ci}>
          {/* fader tracks */}
          <line x1={c.x} x2={c.x} y1={top} y2={bottom} stroke={C.track} strokeWidth={2} />
          <line x1={c.x + 60} x2={c.x + 60} y1={top} y2={bottom} stroke={C.track} strokeWidth={2} />
          {/* tick scale */}
          {Array.from({ length: 49 }, (_, i) => {
            const y = top + ((bottom - top) * i) / 48;
            const major = i % 4 === 0;
            return <line key={i} x1={c.scale - (major ? 10 : 6)} x2={c.scale + (major ? 10 : 6)} y1={y} y2={y} stroke={C.tick} strokeWidth={major ? 1.6 : 1} />;
          })}
          <line x1={c.scale} x2={c.scale} y1={top} y2={bottom} stroke={C.tick} strokeWidth={1} opacity={0.5} />
          {/* white fader handles */}
          {[c.fader, c.fader + 1].map((k, hi) => (
            <rect key={k} display={qaOff("faders") ? "none" : undefined} x={c.x + hi * 60 - 7} y={faderY(k) - 14} width={14} height={28} rx={1.5} fill={C.handle} filter="url(#ae-glow-soft)" />
          ))}
        </g>
      ))}
      <Label x={20} y={926}>CTRL_SET</Label>
    </g>
  );
};

const TopRow: React.FC<{ t: number; p: number }> = ({ t, p }) => {
  const eqX0 = 548;
  const eqDx = 46;
  return (
    <g>
      <Label x={284} y={30}>DOTS_INF</Label>
      {DOTS.map((d, i) => (
        <circle key={i} display={qaOff("indicators") ? "none" : undefined} cx={d.x} cy={d.y} r={1.6} fill={C.dot} opacity={d.o * (0.55 + 0.45 * Math.sin(TAU * d.k * p + d.ph))} />
      ))}
      <Label x={eqX0 - 18} y={30}>EQ_SET</Label>
      {EQ_LEVELS.map((lv, i) => {
        const x = eqX0 + i * eqDx;
        const y = 150 - lv[t] * 96;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={42} y2={156} stroke={C.track} strokeWidth={2} />
            <rect display={qaOff("indicators") ? "none" : undefined} x={x - 7} y={y - 11} width={14} height={22} rx={1.5} fill={C.indicator} filter="url(#ae-glow-red)" />
          </g>
        );
      })}
      <Label x={1288} y={30}>MIX_BUS</Label>
      {SLIDERS.map((s, i) => {
        const y = 52 + i * 30;
        const x = 1300 + 560 * (s.base + s.a * Math.sin(TAU * s.k * p + s.ph));
        return (
          <g key={i}>
            <line x1={1300} x2={1880} y1={y} y2={y} stroke={C.track} strokeWidth={2} />
            <rect display={qaOff("faders") ? "none" : undefined} x={x - 12} y={y - 7} width={24} height={14} rx={1.5} fill={C.sliderHandle} />
          </g>
        );
      })}
    </g>
  );
};

const BottomRow: React.FC<{ t: number }> = ({ t }) => {
  const y = 1005;
  const btn = 52;
  const bx0 = 500;
  return (
    <g>
      {/* status lights: one green, three grey */}
      <circle cx={52} cy={y} r={20} fill={C.statusOn} filter="url(#ae-glow-soft)" />
      {[108, 162, 216].map((x) => (
        <circle key={x} cx={x} cy={y} r={20} fill={C.statusOff} />
      ))}
      {/* transport buttons */}
      {ICONS.map((d, i) => {
        const x = bx0 + i * (btn + 22);
        return (
          <g key={i}>
            <rect x={x} y={y - btn / 2} width={btn} height={btn} rx={6} fill={C.button} stroke={C.buttonEdge} strokeWidth={1.2} />
            <path d={d} transform={`translate(${x + btn / 2 - 14} ${y - 14}) scale(${28 / 24})`} fill={C.icon} fillRule="evenodd" />
          </g>
        );
      })}
      {/* LED grid */}
      {LEDS.map((led, i) => {
        const c = i % LED_COLS;
        const r = Math.floor(i / LED_COLS);
        const on = led.on[t];
        const fill = led.red ? (on ? C.ledRed : C.ledRedOff) : on ? C.ledGrey : C.ledGreyOff;
        return <rect key={i} display={qaOff("leds") ? "none" : undefined} x={1580 + c * 40} y={952 + r * 30} width={12} height={12} rx={1} fill={fill} filter={on && led.red ? "url(#ae-glow-red)" : undefined} />;
      })}
    </g>
  );
};

export const AudioEditor: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame % LOOP_FRAMES;
  const p = t / LOOP_FRAMES;
  return (
    <Frame background={C.background}>
      <defs>
        <linearGradient id="ae-strip" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={C.stripEdge} />
          <stop offset="0.5" stopColor={C.stripMid} />
          <stop offset="1" stopColor={C.stripEdge} />
        </linearGradient>
        <linearGradient id="ae-centre-glow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={C.wave} stopOpacity={0} />
          <stop offset="0.5" stopColor={C.wave} stopOpacity={0.22} />
          <stop offset="1" stopColor={C.wave} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="ae-panel" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={C.panelTop} />
          <stop offset="1" stopColor={C.background} />
        </linearGradient>
        <filter id="ae-bokeh" x="0" y="0" width={DESIGN_W} height={DESIGN_H} filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation={5} />
        </filter>
        <GlowFilter id="ae-glow" base={2} strength={[1, 1, 0.75]} region={{ x: 0, y: 0, width: DESIGN_W, height: DESIGN_H }} />
        <GlowFilter id="ae-glow-soft" base={1.2} strength={[0.7, 0.4, 0.2]} />
        <GlowFilter id="ae-glow-red" base={1.2} strength={[0.8, 0.5, 0.25]} />
        {STRIP_Y.map((y, i) => (
          <clipPath key={i} id={`ae-clip-${i}`}>
            <rect x={STRIP_X0} y={y} width={STRIP_W} height={STRIP_H} />
          </clipPath>
        ))}
      </defs>
      <rect width={DESIGN_W} height={DESIGN_H} fill="url(#ae-panel)" />
      {/* panel dividers */}
      <g stroke={C.panelLine} strokeWidth={1}>
        <line x1={262} x2={262} y1={14} y2={940} />
        <line x1={0} x2={DESIGN_W} y1={940} y2={940} />
        <line x1={262} x2={DESIGN_W} y1={168} y2={168} />
      </g>
      <TopRow t={t} p={p} />
      <LevelMeters p={p} />
      {CHANNELS.map((ch, i) => (
        <ChannelStrip key={i} ch={ch} y={STRIP_Y[i]} p={p} index={i} />
      ))}
      <BottomRow t={t} />
      <Grain seed={t} amount={0.04} />
    </Frame>
  );
};
