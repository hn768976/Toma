import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GenerateRow, STORY_FRAMES } from "../data";
import { hash3, mulberry32 } from "../lib/random";

// Flat 2D story drawn with Canvas 2D. All coordinates are in composition
// pixels (3840 x 2160); the canvas backing store is scaled by the render
// scale so a 720p preview does not draw a 4K canvas.
//
// Glow: the bright layer is drawn again into a quarter-resolution canvas,
// blurred with a canvas filter and added back on top ("lighter").

const W = 3840;
const H = 2160;
const TAU = Math.PI * 2;
const FONT = "Poppins";

// ------------------------------------------------------------------ timing
const F_FADE_END = 18; // 0.6 s
const F_CURSOR_START = 18;
const F_CURSOR_END = 42; // 1.4 s
const F_CLICK = 42;
const F_SLIDE_START = 48; // 1.6 s
const F_SLIDE_END = 78; // 2.6 s
const F_REVEAL = 78;

// button geometry
const BTN_ASPECT = 3.05;
const START = { x: 0.28 * W, y: 0.25 * H, w: 0.28 * W };
const END = { x: 0.5 * W, y: 0.5 * H, w: 0.15 * W };
const C = { x: END.x, y: END.y };
const BTN_END_H = END.w / BTN_ASPECT;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

const hexToRgb = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const;
};
const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
const mixHex = (a: string, b: string, t: number) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const m = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return `#${((1 << 24) | (m(0) << 16) | (m(1) << 8) | m(2)).toString(16).slice(1)}`;
};

// ------------------------------------------------------------------ traces
type Pt = [number, number];
type Trace = {
  pts: Pt[];
  cum: number[];
  len: number;
  width: number;
  start: number; // frame the draw-on starts
  dur: number; // frames to draw on
  tone: number; // 0..1 colour mix
  pulses: { speed: number; len: number; phase: number }[];
  faint: boolean;
  pad: boolean;
};

const polyLen = (pts: Pt[]) => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return cum;
};

const pointAt = (t: Trace, s: number): Pt => {
  const d = Math.min(Math.max(s, 0), t.len);
  let i = 1;
  while (i < t.cum.length - 1 && t.cum[i] < d) i++;
  const a = t.pts[i - 1];
  const b = t.pts[i];
  const seg = t.cum[i] - t.cum[i - 1] || 1;
  const u = (d - t.cum[i - 1]) / seg;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
};

// sub-path between arc lengths s0..s1
const subPath = (ctx: CanvasRenderingContext2D, t: Trace, s0: number, s1: number) => {
  const a = Math.max(0, s0);
  const b = Math.min(t.len, s1);
  if (b <= a) return false;
  const p0 = pointAt(t, a);
  ctx.moveTo(p0[0], p0[1]);
  for (let i = 1; i < t.pts.length; i++) {
    if (t.cum[i] > a && t.cum[i] < b) ctx.lineTo(t.pts[i][0], t.pts[i][1]);
  }
  const p1 = pointAt(t, b);
  ctx.lineTo(p1[0], p1[1]);
  return true;
};

const makeTrace = (pts: Pt[], rng: () => number, start: number, faint: boolean, width: number): Trace => {
  const cum = polyLen(pts);
  const len = cum[cum.length - 1];
  const nP = faint ? 0 : 1 + (rng() < 0.45 ? 1 : 0);
  return {
    pts,
    cum,
    len,
    width,
    start,
    dur: Math.max(16, len / (38 + rng() * 30)),
    tone: rng(),
    pulses: Array.from({ length: nP }, () => ({ speed: 14 + rng() * 22, len: 90 + rng() * 200, phase: rng() })),
    faint,
    pad: !faint && rng() < 0.25,
  };
};

const buildCircuit = (seed: number): Trace[] => {
  const rng = mulberry32(seed * 7919 + 1);
  const traces: Trace[] = [];
  const bw = END.w;
  const bh = BTN_END_H;
  // horizontal bundles
  for (const side of [-1, 1]) {
    const N = 34;
    for (let i = 0; i < N; i++) {
      const lane = (i + 0.5) / N - 0.5; // -0.5..0.5
      const y0 = C.y + lane * bh * 1.35 + (rng() - 0.5) * 3;
      const x0 = C.x + side * (bw / 2 - 30);
      const pts: Pt[] = [[x0, y0]];
      let x = x0 + side * (30 + rng() * 260);
      let y = y0;
      pts.push([x, y]);
      // 45-degree jog away from (or toward) the axis
      const away = Math.sign(lane || 1) * (rng() < 0.8 ? 1 : -1);
      const jog = (rng() < 0.45 ? 1 : 0) * (16 + rng() * 60) * (0.5 + Math.abs(lane) * 1.2);
      x += side * jog;
      y += away * jog;
      pts.push([x, y]);
      x += side * (80 + rng() * 520);
      pts.push([x, y]);
      if (rng() < 0.45) {
        const j2 = 15 + rng() * 60;
        x += side * j2;
        y += (rng() < 0.5 ? -1 : 1) * j2;
        pts.push([x, y]);
      }
      const reach = rng();
      const xe = reach < 0.45 ? C.x + side * (W * 0.56) : x + side * (60 + rng() * 900);
      pts.push([xe, y]);
      const start = F_REVEAL + 4 + Math.abs(lane) * 30 + rng() * 22;
      traces.push(makeTrace(pts, rng, start, false, 4 + rng() * 3));
    }
    // faint companion lines
    for (let i = 0; i < 40; i++) {
      const y0 = C.y + (rng() - 0.5) * bh * 1.45;
      const x0 = C.x + side * (bw / 2 - 20);
      const xe = C.x + side * (W * (0.35 + rng() * 0.2));
      traces.push(makeTrace([[x0, y0], [xe, y0]], rng, F_REVEAL + 10 + rng() * 40, true, 2));
    }
  }
  // vertical bundles
  for (const side of [-1, 1]) {
    const N = 14;
    for (let i = 0; i < N; i++) {
      const lane = (i + 0.5) / N - 0.5;
      const x0 = C.x + lane * bw * 0.55 + (rng() - 0.5) * 3;
      const y0 = C.y + side * (bh / 2 - 20);
      const pts: Pt[] = [[x0, y0]];
      let x = x0;
      let y = y0 + side * (40 + rng() * 160);
      pts.push([x, y]);
      const away = Math.sign(lane || 1) * (rng() < 0.75 ? 1 : -1);
      const jog = (rng() < 0.45 ? 1 : 0) * (12 + rng() * 45) * (0.5 + Math.abs(lane) * 1.2);
      x += away * jog;
      y += side * jog;
      pts.push([x, y]);
      y += side * (60 + rng() * 260);
      pts.push([x, y]);
      if (rng() < 0.5) {
        const j2 = 12 + rng() * 50;
        x += (rng() < 0.5 ? -1 : 1) * j2;
        y += side * j2;
        pts.push([x, y]);
      }
      const ye = rng() < 0.5 ? C.y + side * (H * 0.56) : y + side * (60 + rng() * 380);
      pts.push([x, ye]);
      const start = F_REVEAL + 10 + Math.abs(lane) * 26 + rng() * 22;
      traces.push(makeTrace(pts, rng, start, false, 4 + rng() * 2.5));
    }
    for (let i = 0; i < 16; i++) {
      const x0 = C.x + (rng() - 0.5) * bw * 0.6;
      const y0 = C.y + side * (bh / 2 - 10);
      const ye = C.y + side * H * (0.3 + rng() * 0.25);
      traces.push(makeTrace([[x0, y0], [x0, ye]], rng, F_REVEAL + 16 + rng() * 40, true, 2));
    }
  }
  return traces;
};

// ------------------------------------------------------------------ squares
type Square = { x: number; y: number; s: number; hollow: boolean; col: string; period: number; phase: number; drift: number };
const buildSquares = (seed: number, cols: string[]): Square[] => {
  const rng = mulberry32(seed * 104729 + 3);
  return Array.from({ length: 150 }, () => {
    const r = rng();
    return {
      x: rng() * W,
      y: rng() * H,
      s: r < 0.45 ? 14 + rng() * 14 : r < 0.85 ? 30 + rng() * 26 : 60 + rng() * 30,
      hollow: rng() < 0.62,
      col: cols[Math.floor(rng() * cols.length)],
      period: 50 + rng() * 110,
      phase: rng(),
      drift: rng() < 0.2 ? (rng() - 0.5) * 1.2 : 0,
    };
  });
};

// ------------------------------------------------------------------ shapes
const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

// four-point sparkle with concave sides
const sparklePath = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  const k = 0.16 * s;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x + k, y - k, x + s, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + s);
  ctx.quadraticCurveTo(x - k, y + k, x - s, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - s);
  ctx.closePath();
};

// generic arrow pointer (tip at 0,0), 1 unit = 1/32 of its height
const CURSOR: Pt[] = [
  [0, 0],
  [0, 25],
  [6.2, 19.4],
  [10.4, 28.8],
  [14.6, 27],
  [10.5, 17.8],
  [18.6, 17.8],
];
const cursorPath = (ctx: CanvasRenderingContext2D, x: number, y: number, u: number) => {
  ctx.beginPath();
  CURSOR.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(x + px * u, y + py * u) : ctx.lineTo(x + px * u, y + py * u)));
  ctx.closePath();
};

// ------------------------------------------------------------------ noise tile (dither)
const DITHER = (() => {
  const rng = mulberry32(424242);
  const n = 64 * 64;
  const t = new Int8Array(n);
  // triangular +-1
  for (let i = 0; i < n; i++) t[i] = Math.round(rng() + rng() - 1);
  return t;
})();

// ------------------------------------------------------------------ main
type Ctx = CanvasRenderingContext2D;

type State = {
  f: number;
  btn: { x: number; y: number; w: number; h: number; alpha: number; press: number; flash: number };
  cursor: { x: number; y: number; alpha: number };
  ripple: { r: number; a: number; x: number; y: number };
  reveal: number; // 0.. frames since reveal start
};

const stateAt = (f: number, fps: number): State => {
  const fade = easeOut(f / F_FADE_END);
  const slide = easeInOut((f - F_SLIDE_START) / (F_SLIDE_END - F_SLIDE_START));
  const x = START.x + (END.x - START.x) * slide;
  const y = START.y + (END.y - START.y) * slide;
  const w = START.w + (END.w - START.w) * slide;
  // click: spring down to 94 % and back
  const sp = spring({ frame: f - F_CLICK, fps, config: { damping: 9, stiffness: 260, mass: 0.6 } });
  const down = f >= F_CLICK ? interpolate(f - F_CLICK, [0, 3], [0, 1], { extrapolateRight: "clamp" }) : 0;
  const press = f < F_CLICK ? 1 : 1 - 0.06 * down * (1 - sp) - 0.0 * sp;
  const flash = f >= F_CLICK ? Math.exp(-(f - F_CLICK) / 9) : 0;
  // cursor
  const cu = Easing.bezier(0.22, 0.8, 0.3, 1)(clamp01((f - F_CURSOR_START) / (F_CURSOR_END - F_CURSOR_START)));
  const clickX = START.x + START.w * 0.18;
  const clickY = START.y + START.w / BTN_ASPECT * 0.2;
  const fromX = 0.8 * W;
  const fromY = 0.92 * H;
  // follows the button during the slide a little, then fades
  const cx = fromX + (clickX - fromX) * cu + (x - START.x) * 0.35;
  const cy = fromY + (clickY - fromY) * cu + (y - START.y) * 0.35;
  const calpha = interpolate(f, [F_CURSOR_START, F_CURSOR_START + 6, F_SLIDE_START, F_SLIDE_START + 16], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rt = (f - F_CLICK) / 30;
  return {
    f,
    btn: { x, y, w, h: w / BTN_ASPECT, alpha: fade, press, flash },
    cursor: { x: cx, y: cy, alpha: calpha },
    ripple: { r: 40 + 520 * easeOut(rt), a: f >= F_CLICK && rt < 1 ? (1 - rt) * 0.8 : 0, x: clickX, y: clickY },
    reveal: f - F_REVEAL,
  };
};

const drawSquares = (ctx: Ctx, sq: Square[], f: number, glow: boolean) => {
  for (const s of sq) {
    const tw = 0.5 + 0.5 * Math.sin(TAU * (f / s.period + s.phase));
    const a = Math.pow(tw, 6) * 0.8;
    if (a < 0.02) continue;
    const y = s.y + s.drift * f;
    const x = s.x + s.drift * 0.4 * f;
    // keep the centre (button, ring, bands) clear of squares
    if (Math.abs(x - C.x) < H * 0.27 && Math.abs(y - C.y) < H * 0.27) continue;
    ctx.globalAlpha = a * (glow ? 0.8 : 1);
    if (s.hollow) {
      ctx.strokeStyle = s.col;
      ctx.lineWidth = glow ? 6 : 3.5;
      ctx.strokeRect(x - s.s / 2, y - s.s / 2, s.s, s.s);
    } else {
      ctx.fillStyle = s.col;
      ctx.fillRect(x - s.s / 2, y - s.s / 2, s.s, s.s);
    }
  }
  ctx.globalAlpha = 1;
};

const drawCircuit = (ctx: Ctx, row: GenerateRow, traces: Trace[], st: State, glow: boolean) => {
  const f = st.f;
  if (st.reveal < 0) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // faint data stream along the horizontal axis
  if (!glow) {
    const spread = easeOut(st.reveal / 70) * W * 0.55;
    for (let k = -3; k <= 3; k++) {
      const y = C.y + k * 13;
      for (let i = 0; i < 160; i++) {
        const off = ((i * 17 + f * 9 + Math.abs(k) * 7) % (W * 0.55));
        if (off > spread) continue;
        const h = hash3(i, k + 10, 7);
        if (h < 0.35) continue;
        ctx.globalAlpha = 0.18 + 0.3 * hash3(i, k, Math.floor(f / 3));
        ctx.fillStyle = row.traceFrom;
        ctx.fillRect(C.x + off, y - 2, 5, 4);
        ctx.fillRect(C.x - off - 5, y - 2, 5, 4);
      }
    }
    ctx.globalAlpha = 1;
  }
  for (const t of traces) {
    const p = clamp01((f - t.start) / t.dur);
    if (p <= 0) continue;
    const drawn = t.len * easeOut(p);
    const [x0, y0] = t.pts[0];
    const [xe, ye] = t.pts[t.pts.length - 1];
    if (t.faint) {
      if (glow) continue;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = row.buttonTo;
      ctx.lineWidth = t.width;
      ctx.beginPath();
      if (subPath(ctx, t, 0, drawn)) ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    const grad = ctx.createLinearGradient(x0, y0, xe, ye);
    // dim near the button, brightest out along the bands, fading at the tips
    const dim = t.tone < 0.35 ? 1 : 0.45;
    grad.addColorStop(0, rgba(mixHex(row.traceTo, row.buttonTo, 0.5), 0.55 * dim));
    grad.addColorStop(0.45, rgba(mixHex(row.traceFrom, row.traceTo, 0.3 + 0.4 * t.tone), dim));
    grad.addColorStop(0.85, rgba(row.traceTo, dim * 0.8));
    grad.addColorStop(1, rgba(row.traceTo, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = glow ? t.width * 1.8 : t.width * 0.8;
    ctx.globalAlpha = glow ? 0.35 : 0.85;
    ctx.beginPath();
    if (subPath(ctx, t, 0, drawn)) ctx.stroke();
    ctx.globalAlpha = 1;
    // end pad
    if (t.pad && p >= 1) {
      ctx.fillStyle = row.traceTo;
      ctx.beginPath();
      ctx.arc(xe, ye, t.width * 1.1, 0, TAU);
      ctx.fill();
    }
    // white-hot head while drawing
    if (p < 1) {
      const [hx, hy] = pointAt(t, drawn);
      ctx.fillStyle = row.head;
      ctx.beginPath();
      ctx.arc(hx, hy, glow ? t.width * 2.4 : t.width * 1.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = row.head;
      ctx.lineWidth = t.width * (glow ? 2 : 1.2);
      ctx.beginPath();
      if (subPath(ctx, t, drawn - 70, drawn)) ctx.stroke();
    }
    // fine data specks along the trace
    if (!glow && p >= 1 && t.tone > 0.3) {
      ctx.fillStyle = row.head;
      for (let k = 0; k < 6; k++) {
        const hs = hash3(k, Math.floor(t.len), Math.floor((f + k * 7) / 9));
        const [sx, sy] = pointAt(t, hs * t.len);
        ctx.globalAlpha = 0.35 + 0.5 * hash3(k, Math.floor(t.len), 77);
        ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
      }
      ctx.globalAlpha = 1;
    }
    // pulses travelling outward once the trace is drawn
    if (p >= 1) {
      const since = f - (t.start + t.dur);
      for (const pu of t.pulses) {
        const cyc = t.len + pu.len;
        const s = (since * pu.speed + pu.phase * cyc) % cyc;
        const g = ctx.createLinearGradient(...pointAt(t, s - pu.len), ...pointAt(t, s));
        g.addColorStop(0, rgba(row.traceFrom, 0));
        g.addColorStop(0.75, rgba(row.traceFrom, 0.85));
        g.addColorStop(1, mixHex(row.traceFrom, row.head, 0.45));
        ctx.strokeStyle = g;
        ctx.lineWidth = t.width * (glow ? 2.0 : 1.2);
        ctx.beginPath();
        if (subPath(ctx, t, s - pu.len, s)) ctx.stroke();
      }
    }
  }
};

type Wave = { phases: number[]; freqs: number[]; speeds: number[]; ticksPhase: number[] };
const buildWave = (seed: number): Wave => {
  const rng = mulberry32(seed * 31337 + 9);
  return {
    phases: Array.from({ length: 8 }, () => rng() * TAU),
    freqs: [3.1, 5.3, 8.7, 13.9, 21.7, 34.1, 55.3, 89.9],
    speeds: Array.from({ length: 8 }, () => 0.04 + rng() * 0.12),
    ticksPhase: Array.from({ length: 240 }, () => rng()),
  };
};

const drawWaveform = (ctx: Ctx, row: GenerateRow, wave: Wave, st: State, glow: boolean) => {
  const f = st.f;
  if (st.reveal < 0) return;
  const spread = easeOut(st.reveal / 60);
  const N = 400;
  const barW = (W / N) * 0.5;
  const maxH = H * 0.13;
  for (let i = 0; i < N; i++) {
    const x = (i + 0.5) * (W / N);
    const u = (x - C.x) / (W / 2); // -1..1
    const au = Math.abs(u);
    if (au > spread * 1.02) continue;
    const edgeFade = clamp01((spread - au) / 0.08);
    // speech-like: smooth lens-shaped bursts that drift and breathe, from a
    // seeded sum of sines; a little per-bar noise on top
    const bu = u * 4.2 + Math.sin(f * 0.013 + wave.phases[0]) * 0.6;
    const burstIdx = Math.floor(bu + 0.5);
    const local = bu - burstIdx; // -0.5..0.5 within a burst
    const bph = wave.phases[(burstIdx + 80) % 8];
    const lens = Math.pow(Math.cos(local * Math.PI), 1.6) * (0.55 + 0.45 * Math.abs(Math.sin(u * 23.0 + bph + f * 0.05)));
    const amp = 0.25 + 0.75 * Math.abs(Math.sin(f * wave.speeds[(burstIdx + 80) % 8] * 0.6 + bph + burstIdx));
    let fine = 0;
    for (let k = 4; k < 8; k++) fine += Math.sin(u * wave.freqs[k] * 3 + f * wave.speeds[k] * 6 + wave.phases[k]);
    fine = 0.7 + 0.3 * Math.abs(fine) / 2.2;
    const n = 0.8 + 0.2 * hash3(i, Math.floor(f / 2), 3);
    const near = 1 - 0.25 * au;
    const quiet = amp * lens < 0.12;
    const h = quiet ? 3 : Math.max(4, maxH * amp * lens * fine * n * near) * edgeFade;
    const a = (0.6 + 0.4 * near) * edgeFade * (quiet && i % 2 ? 0 : 1);
    const tone = (Math.sin(burstIdx * 2.3 + bph) + 1) / 2;
    const bodyCol = mixHex("#1A50FF", row.traceFrom, 0.4 + 0.6 * tone);
    const grad = ctx.createLinearGradient(0, C.y - h, 0, C.y + h);
    grad.addColorStop(0, row.traceTo);
    grad.addColorStop(0.3, bodyCol);
    grad.addColorStop(0.7, bodyCol);
    grad.addColorStop(1, row.traceTo);
    ctx.fillStyle = grad;
    // inside the ring the waveform almost disappears
    const inRing = Math.abs(x - C.x) < H * 0.2 ? 0.18 : 1;
    ctx.globalAlpha = (glow ? a * 0.35 : a) * inRing;
    const hh = Math.abs(x - C.x) < H * 0.2 ? Math.min(h, 14) : h;
    ctx.fillRect(x - barW / 2, C.y - hh, glow ? barW * 1.3 : barW, hh * 2);
  }
  ctx.globalAlpha = 1;
  // circular spectrum ring
  const grow = easeOut((st.reveal - 6) / 45);
  if (grow <= 0) return;
  const R = H * 0.225 * (0.4 + 0.6 * grow);
  const rot = f * 0.0035;
  const T = 240;
  ctx.lineCap = "round";
  for (let i = 0; i < T; i++) {
    const a = (i / T) * TAU + rot;
    const ph = wave.ticksPhase[i];
    let spec = 0;
    for (let k = 0; k < 3; k++) spec += Math.sin(a * (k * 3 + 4) + f * wave.speeds[k] * 2 + wave.phases[k]);
    spec = Math.max(0, spec * 0.42 + 0.2) * (0.6 + 0.4 * hash3(i, Math.floor(f / 2), 5)) + 0.1 * Math.sin(TAU * (f / 40 + ph));
    const len = (14 + 62 * Math.max(0, spec)) * grow;
    const r0 = R - len * 0.35;
    const r1 = R + len * 0.65;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const grad = ctx.createLinearGradient(C.x + ca * r0, C.y + sa * r0, C.x + ca * r1, C.y + sa * r1);
    const ringTone = 0.5 + 0.5 * Math.sin(a - 0.6);
    const tc = mixHex("#1A50FF", row.traceTo, ringTone);
    grad.addColorStop(0, tc);
    grad.addColorStop(1, mixHex(tc, row.traceTo, 0.6));
    ctx.strokeStyle = grad;
    ctx.globalAlpha = grow * (0.65 + 0.35 * clamp01(spec * 2));
    ctx.lineWidth = glow ? 7 : 6;
    ctx.beginPath();
    ctx.moveTo(C.x + ca * r0, C.y + sa * r0);
    ctx.lineTo(C.x + ca * r1, C.y + sa * r1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const drawButton = (ctx: Ctx, row: GenerateRow, st: State, glow: boolean) => {
  const b = st.btn;
  if (b.alpha <= 0) return;
  const w = b.w * b.press;
  const h = b.h * b.press;
  const x = b.x - w / 2;
  const y = b.y - h / 2;
  const r = h * 0.3;
  ctx.globalAlpha = b.alpha;
  if (glow) {
    // soft outer glow (blurred later) + flash on click
    roundRectPath(ctx, x - h * 0.06, y - h * 0.06, w + h * 0.12, h + h * 0.12, r * 1.1);
    ctx.fillStyle = rgba(row.glow, 0.4 + 0.6 * b.flash);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  // body gradient (horizontal)
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, row.buttonFrom);
  g.addColorStop(1, row.buttonTo);
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  // depth: darker bottom, lighter top (glossy)
  const v = ctx.createLinearGradient(0, y, 0, y + h);
  v.addColorStop(0, "rgba(255,255,255,0.20)");
  v.addColorStop(0.45, "rgba(255,255,255,0.0)");
  v.addColorStop(1, "rgba(0,0,30,0.30)");
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);
  // top highlight band
  const hb = ctx.createLinearGradient(0, y + h * 0.05, 0, y + h * 0.48);
  hb.addColorStop(0, "rgba(255,255,255,0.38)");
  hb.addColorStop(1, "rgba(255,255,255,0.04)");
  roundRectPath(ctx, x + h * 0.08, y + h * 0.06, w - h * 0.16, h * 0.4, r * 0.75);
  ctx.fillStyle = hb;
  ctx.fill();
  // flash
  if (b.flash > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${0.25 * b.flash})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  // outline
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = rgba(row.outline, 0.95);
  ctx.lineWidth = Math.max(2, h * 0.022);
  ctx.stroke();
  // label: sparkle + word, centred as a group
  const fs = h * 0.36;
  ctx.font = `600 ${fs}px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  const tw = ctx.measureText(row.label).width;
  const sp = h * 0.17;
  const gap = h * 0.13;
  const total = sp * 2 + gap + tw;
  const gx = b.x - total / 2;
  const base = b.y + fs * 0.36;
  ctx.fillStyle = "rgba(10,20,60,0.25)";
  ctx.fillText(row.label, gx + sp * 2 + gap + h * 0.01, base + h * 0.02);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(row.label, gx + sp * 2 + gap, base);
  sparklePath(ctx, gx + sp, b.y + h * 0.02, sp);
  ctx.fill();
  sparklePath(ctx, gx + sp * 1.75, b.y - sp * 0.9, sp * 0.42);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const drawCursorAndRipple = (ctx: Ctx, row: GenerateRow, st: State, glow: boolean) => {
  const rp = st.ripple;
  if (rp.a > 0) {
    ctx.strokeStyle = rgba(row.outline, rp.a * (glow ? 0.6 : 0.8));
    ctx.lineWidth = glow ? 14 : 6;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, rp.r, 0, TAU);
    ctx.stroke();
  }
  if (glow) return;
  const c = st.cursor;
  if (c.alpha <= 0) return;
  const u = 4.6;
  ctx.globalAlpha = c.alpha;
  // tiny shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  cursorPath(ctx, c.x + 5, c.y + 7, u);
  ctx.fill();
  cursorPath(ctx, c.x, c.y, u);
  ctx.fillStyle = "#F4F6FA";
  ctx.fill();
  ctx.strokeStyle = "#20242C";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.globalAlpha = 1;
};

export const GenerateButton: React.FC<{ row: GenerateRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement | null>(null);
  const blurRef = useRef<HTMLCanvasElement | null>(null);
  const [fontHandle] = useState(() => delayRender("Loading Poppins SemiBold"));
  const [fontReady, setFontReady] = useState(false);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cw = Math.round(W * dpr);
  const ch = Math.round(H * dpr);

  const traces = useMemo(() => (row.reveal === "circuit" ? buildCircuit(row.seed) : []), [row]);
  const wave = useMemo(() => buildWave(row.seed), [row]);
  const squares = useMemo(() => buildSquares(row.seed, row.squares), [row]);

  useEffect(() => {
    const face = new FontFace(FONT, `url(${staticFile("fonts/Poppins-SemiBold.woff2")}) format("woff2")`, {
      weight: "600",
      style: "normal",
    });
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        return document.fonts.ready;
      })
      .then(() => {
        setFontReady(true);
        continueRender(fontHandle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(fontHandle);
      });
  }, [fontHandle]);

  useLayoutEffect(() => {
    if (!fontReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Re-assigning the size resets the whole 2D context state (lineCap,
    // lineJoin, filters, ...), so nothing carries over from the previous frame
    // rendered in this tab.
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    const gw = Math.max(1, Math.round(cw / 4));
    const gh = Math.max(1, Math.round(ch / 4));
    if (!glowRef.current) glowRef.current = document.createElement("canvas");
    if (!blurRef.current) blurRef.current = document.createElement("canvas");
    const glowC = glowRef.current;
    const blurC = blurRef.current;
    glowC.width = gw;
    glowC.height = gh;
    blurC.width = gw;
    blurC.height = gh;
    const gctx = glowC.getContext("2d")!;
    const bctx = blurC.getContext("2d")!;
    const f = frame;
    const st = stateAt(f, fps);

    const drawFx = (c: Ctx, glow: boolean) => {
      drawSquares(c, squares, f, glow);
      if (row.reveal === "circuit") drawCircuit(c, row, traces, st, glow);
      else drawWaveform(c, row, wave, st, glow);
    };
    const drawUi = (c: Ctx, glow: boolean) => {
      drawButton(c, row, st, glow);
      drawCursorAndRipple(c, row, st, glow);
    };
    const drawAll = (c: Ctx, glow: boolean) => {
      drawFx(c, glow);
      drawUi(c, glow);
    };

    // crisp layer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    if (st.reveal > 0) {
      const hz = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, ch * 0.75);
      const ha = Math.min(1, st.reveal / 60);
      hz.addColorStop(0, `rgba(0,10,34,${ha})`);
      hz.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hz;
      ctx.fillRect(0, 0, cw, ch);
    }
    // bright layer at quarter resolution
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.fillStyle = "#000";
    gctx.fillRect(0, 0, gw, gh);
    gctx.setTransform(gw / W, 0, 0, gh / H, 0, 0);
    drawAll(gctx, true);
    // blur it twice (tight + wide) into the blur canvas
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = "source-over";
    bctx.filter = "none";
    bctx.fillStyle = "#000";
    bctx.fillRect(0, 0, gw, gh);
    bctx.globalCompositeOperation = "lighter";
    const unit = gh / 540; // blur radii relative to frame height
    bctx.filter = `blur(${(4 * unit).toFixed(3)}px)`;
    bctx.globalAlpha = 0.7;
    bctx.drawImage(glowC, 0, 0);
    bctx.filter = `blur(${(16 * unit).toFixed(3)}px)`;
    bctx.globalAlpha = 0.5;
    bctx.drawImage(glowC, 0, 0);
    bctx.filter = "none";
    bctx.globalAlpha = 1;

    // glow under, crisp on top, glow again (additive) for bloom
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(blurC, 0, 0, cw, ch);
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(cw / W, 0, 0, ch / H, 0, 0);
    drawFx(ctx, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.28;
    ctx.drawImage(blurC, 0, 0, cw, ch);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    // the button and cursor sit on top of the glow, crisp
    ctx.setTransform(cw / W, 0, 0, ch / H, 0, 0);
    drawUi(ctx, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // grain (~1.5 %, only where brighter than ~2 %) + +-1/255 dither tile
    // (every non-black pixel).
    // Both are fixed functions of pixel position and frame % 450.
    const img = ctx.getImageData(0, 0, cw, ch);
    const d = img.data;
    const fm = ((f % STORY_FRAMES) + STORY_FRAMES) % STORY_FRAMES;
    const ox = (fm * 37) & 63;
    const oy = (fm * 23) & 63;
    for (let y = 0; y < ch; y++) {
      const row64 = ((y + oy) & 63) << 6;
      for (let x = 0; x < cw; x++) {
        const i = (y * cw + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        if (r === 0 && g === 0 && b === 0) continue; // pure black stays black
        const dith = DITHER[row64 + ((x + ox) & 63)];
        // grain only where brighter than ~2 %; the dither everywhere else too
        const gr = lum < 5 ? 0 : (hash3(x, y, fm) - 0.5) * 2 * 0.015 * 255 * Math.min(1, (lum - 5) / 20);
        const add = dith + gr;
        d[i] = r + add;
        d[i + 1] = g + add;
        d[i + 2] = b + add;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [frame, fps, fontReady, cw, ch, row, traces, wave, squares]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} width={cw} height={ch} style={{ width: W, height: H }} />
    </AbsoluteFill>
  );
};
