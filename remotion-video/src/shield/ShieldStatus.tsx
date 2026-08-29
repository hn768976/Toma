/**
 * SHIELD STATUS HUD — a 4K, 30-second canvas piece in two variants.
 *
 *   "active"  cyan, a glowing outlined shield with a dot-textured interior,
 *             steady panels, a closed 900-frame loop.
 *   "breach"  magenta, the same shield inverted into a solid dark void with a
 *             burning exclamation inside, a fragmented boundary, and panels
 *             that progressively fail. One-shot, not a loop.
 *
 * Every hex value and every status string in the piece lives in VARIANTS
 * below. Nothing here reads the clock: all motion is a pure function of
 * useCurrentFrame(), and every random draw goes through Remotion's random()
 * with a stable string seed, so `npx remotion render` is deterministic.
 *
 * Drawing model: one <canvas> at the composition's native 3840x2160, plus
 * three offscreen depth buffers. Each element component pushes a draw op onto
 * an ordered queue during render; a single layout effect runs the queue once
 * per frame. No requestAnimationFrame, no CSS animation, no component state.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, random, useCurrentFrame } from "remotion";
import {
  applyPlane,
  bucketForDepth,
  Bucket,
  defocus,
  FRAME_H,
  FRAME_W,
  Layer,
  makeCanvas,
  makeLayer,
  onScreen,
  resetLayer,
  SHIELD_ANCHOR_X,
  SHIELD_ANCHOR_Y,
  TILE_INDICES,
  TILE_W,
  toLocalX,
  toLocalY,
  toScreenX,
  toScreenY,
} from "./plane";
import {
  buildShieldOutline,
  Outline,
  pathExclamationBar,
  pathExclamationDot,
  pathFull,
  pathRange,
} from "./shieldPath";
import {
  buildSurround,
  CodePanelSpec,
  DataCardSpec,
  RowStackSpec,
  Surround,
  Tone,
} from "./layout";
import { displayFont, DISPLAY_FAMILY, fontsLoaded, monoFont, MONO_FAMILY } from "./fonts";

/* ================================================================== *
 * VARIANTS — the single source of colour, wording and behaviour.
 * ================================================================== */

export type VariantName = "active" | "breach";

type Palette = {
  backgroundDeep: string;
  backgroundWash: string;
  panelDim: string;
  codeA: string;
  codeB: string;
  codeC: string;
  shieldLine: string;
  shieldFill: string;
  shieldHot: string;
  wordPrimary: string;
  wordAccent: string;
  card: string;
};

type WordSpec = {
  text: string;
  /** Screen anchor as a fraction of the frame; inverse-mapped onto the plane. */
  sx: number;
  sy: number;
  size: number;
  /**
   * Counter-clockwise degrees within the plane's local space. Every instance
   * uses 0, so all type lies flat on the plane in exactly the shield's
   * perspective; the layout varies by position, size, depth and colour instead.
   */
  rot: number;
  tone: "wordPrimary" | "wordAccent";
  focus: Bucket;
  breathPeriod: number;
  breathPhase: number;
  alpha: number;
};

type GlitchProfile = {
  gapMin: number;
  gapMax: number;
  sliceMin: number;
  sliceMax: number;
  shiftMin: number;
  shiftMax: number;
  durMin: number;
  durMax: number;
  /** Probability the next event follows hard on the last one. */
  cluster: number;
  /** Channel separation on the exclamation mark, in screen px. */
  channelSplitPx: number;
  channelColors: readonly [string, string] | null;
};

type FailureProfile = {
  darkCards: number;
  garbledPanels: number;
  /** Failures are seeded into this span of the timeline. */
  fromFrame: number;
  toFrame: number;
};

export type Variant = {
  palette: Palette;
  words: readonly WordSpec[];
  shieldMode: "outlineGlow" | "solidInverted";
  outlineMode: "continuous" | "fragmented";
  panelBehaviour: "steady" | "failing";
  glitch: GlitchProfile;
  failure: FailureProfile | null;
  /** Strength of the background wash pooled behind the shield. */
  wash: number;
  loops: boolean;
};

export const VARIANTS: Record<VariantName, Variant> = {
  /* #region variant:active */
  active: {
    palette: {
      backgroundDeep: "#020F12",
      backgroundWash: "#06282E",
      panelDim: "#0A3A40",
      codeA: "#4FD4D4",
      codeB: "#3FE07A",
      codeC: "#E8B04F",
      shieldLine: "#3FC4E8",
      shieldFill: "#1A6B8A",
      shieldHot: "#E8FCFF",
      wordPrimary: "#4FD4F5",
      wordAccent: "#E8455F",
      card: "#145056",
    },
    words: [
      // The main instance, seated directly beneath the shield.
      {
        text: "ACTIVE",
        sx: 0.44,
        sy: 0.72,
        size: 176,
        rot: 0,
        tone: "wordPrimary",
        focus: "mid",
        breathPeriod: 300,
        breathPhase: 0,
        alpha: 0.97,
      },
      // Three more scattered across the frame at other depths and sizes.
      {
        text: "ACTIVE",
        sx: 0.16,
        sy: 0.3,
        size: 128,
        rot: 0,
        tone: "wordPrimary",
        focus: "far",
        breathPeriod: 450,
        breathPhase: 1.9,
        alpha: 0.92,
      },
      {
        text: "ACTIVE",
        sx: 0.815,
        sy: 0.6,
        size: 140,
        rot: 0,
        tone: "wordPrimary",
        focus: "near",
        breathPeriod: 225,
        breathPhase: 3.4,
        alpha: 0.86,
      },
      {
        text: "ACTIVE",
        sx: 0.735,
        sy: 0.135,
        size: 104,
        rot: 0,
        tone: "wordAccent",
        focus: "mid",
        breathPeriod: 180,
        breathPhase: 0.8,
        alpha: 0.95,
      },
    ],
    shieldMode: "outlineGlow",
    outlineMode: "continuous",
    panelBehaviour: "steady",
    glitch: {
      gapMin: 60,
      gapMax: 110,
      sliceMin: 2,
      sliceMax: 3,
      shiftMin: 20,
      shiftMax: 70,
      durMin: 2,
      durMax: 3,
      cluster: 0,
      channelSplitPx: 0,
      channelColors: null,
    },
    failure: null,
    wash: 0.55,
    loops: true,
  },
  /* #endregion variant:active */
  /* #region variant:breach */
  breach: {
    palette: {
      backgroundDeep: "#12021A",
      backgroundWash: "#3A0A4A",
      panelDim: "#2E0F3D",
      codeA: "#E85FD4",
      codeB: "#9B5FE8",
      codeC: "#E8B04F",
      shieldLine: "#FF3FC4",
      shieldFill: "#1A0520",
      shieldHot: "#FFE8FA",
      wordPrimary: "#FF5FD4",
      wordAccent: "#3FD4E8",
      card: "#3A1046",
    },
    words: [
      // The main instance, seated directly beneath the shield.
      {
        text: "BREACH",
        sx: 0.44,
        sy: 0.72,
        size: 184,
        rot: 0,
        tone: "wordPrimary",
        focus: "mid",
        breathPeriod: 300,
        breathPhase: 0,
        alpha: 0.97,
      },
      // Four more scattered wider and less evenly than the active layout,
      // with one running off the right edge of the frame.
      {
        text: "DENIED",
        sx: 0.145,
        sy: 0.325,
        size: 130,
        rot: 0,
        tone: "wordPrimary",
        focus: "far",
        breathPeriod: 225,
        breathPhase: 2.2,
        alpha: 0.9,
      },
      {
        text: "LOCKED",
        sx: 0.785,
        sy: 0.155,
        size: 136,
        rot: 0,
        tone: "wordAccent",
        focus: "near",
        breathPeriod: 180,
        breathPhase: 1.1,
        alpha: 0.9,
      },
      {
        text: "BREACH",
        sx: 0.965,
        sy: 0.85,
        size: 116,
        rot: 0,
        tone: "wordPrimary",
        focus: "mid",
        breathPeriod: 450,
        breathPhase: 4.1,
        alpha: 0.93,
      },
      {
        text: "DENIED",
        sx: 0.185,
        sy: 0.875,
        size: 112,
        rot: 0,
        tone: "wordPrimary",
        focus: "far",
        breathPeriod: 450,
        breathPhase: 5.2,
        alpha: 0.88,
      },
    ],
    shieldMode: "solidInverted",
    outlineMode: "fragmented",
    panelBehaviour: "failing",
    glitch: {
      gapMin: 25,
      gapMax: 55,
      sliceMin: 4,
      sliceMax: 6,
      shiftMin: 40,
      shiftMax: 180,
      durMin: 2,
      durMax: 4,
      cluster: 0.45,
      channelSplitPx: 22,
      channelColors: ["#FF2D6F", "#2DE0FF"],
    },
    failure: {
      darkCards: 4,
      garbledPanels: 2,
      fromFrame: 150,
      toFrame: 780,
    },
    wash: 0.82,
    loops: false,
  },
  /* #endregion variant:breach */
};

/* ================================================================== *
 * Timing constants
 * ================================================================== */

const DURATION = 900;
/** Every pulse period below divides DURATION so the loop closes exactly. */
const CELL_PERIODS = [180, 225, 300, 450, 900];
const DOT_PULSE_PERIOD = 300;
const SWEEP_CIRCUITS = 3;
const SWEEP_LENGTH = 0.16;
const GRAIN_TILES = 15;
const GRAIN_TILE_PX = 160;

/** ~30% of frame height, expressed in the plane's local units. */
const SHIELD_SCALE = (FRAME_H * 0.3) / 1.2;

const TAU = Math.PI * 2;

/**
 * Phase of a cycle, in radians. The frame is reduced modulo the period before
 * any trigonometry, so frame 900 evaluates bit-identically to frame 0 for
 * every period that divides 900 — floating-point drift in sin(6*PI) would
 * otherwise leave a scatter of one-LSB differences across the loop seam.
 */
const phaseOf = (frame: number, period: number) =>
  ((frame % period) / period) * TAU;

/* ================================================================== *
 * Colour helpers — hex only ever enters here, from VARIANTS.
 * ================================================================== */

type Rgb = readonly [number, number, number];
type PaletteRgb = Record<keyof Palette, Rgb>;

const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const toneRgb = (c: PaletteRgb, t: Tone): Rgb => {
  switch (t) {
    case "codeA":
      return c.codeA;
    case "codeB":
      return c.codeB;
    case "codeC":
      return c.codeC;
    case "panelDim":
      return c.panelDim;
    case "card":
      return c.card;
    case "wash":
      return c.backgroundWash;
    case "hot":
    default:
      return c.shieldHot;
  }
};

/* ================================================================== *
 * Scene
 * ================================================================== */

type DrawOp = () => void;

type GlitchSlice = { y: number; h: number; dx: number };
type GlitchEvent = { start: number; dur: number; slices: GlitchSlice[] };

type Fragment = {
  t0: number;
  len: number;
  alpha: number;
  flickerPeriod: number;
  flickerPhase: number;
  shiftGap: number;
  shiftDur: number;
  shiftAmount: number;
};

type Scene = {
  frame: number;
  variant: Variant;
  colors: PaletteRgb;
  surround: Surround;
  outline: Outline;
  fragments: Fragment[];
  glitch: GlitchEvent[];
  /** Frame at which each card index goes dark for good; -1 if it never does. */
  darkAt: number[];
  /** Frame at which each panel index corrupts for good; -1 if it never does. */
  garbleAt: number[];
  layers: Record<Bucket, Layer>;
  main: CanvasRenderingContext2D;
  mainCanvas: HTMLCanvasElement;
  scratch: HTMLCanvasElement;
  scratchCtx: CanvasRenderingContext2D;
  /** Ambient drift, and the tiling drift along the plane's x axis. */
  ambientX: number;
  ambientY: number;
  tileShift: number;
  queue: DrawOp[];
  tex: Map<string, HTMLCanvasElement>;
};

const layerFor = (s: Scene, b: Bucket) => s.layers[b];

/** Elements in the blurred buffers add together, so bright ones bloom. */
const beginElement = (s: Scene, b: Bucket, drifted: boolean) => {
  const layer = layerFor(s, b);
  applyPlane(
    layer,
    (drifted ? s.tileShift : 0) + s.ambientX,
    s.ambientY,
  );
  layer.ctx.globalCompositeOperation = b === "mid" ? "source-over" : "lighter";
  layer.ctx.globalAlpha = 1;
  layer.ctx.shadowBlur = 0;
  layer.ctx.filter = "none";
  return layer;
};

/** Alpha falloff that smooths the three discrete blur steps into a gradient. */
const depthAlpha = (localY: number, base: number) =>
  base * (1 - 0.45 * defocus(localY));

/* ================================================================== *
 * Panel behaviour — the rerolling cells
 * ================================================================== */

const cellValue = (s: Scene, index: number): number => {
  if (s.variant.panelBehaviour === "steady") {
    // A constant 4-6 cells per second change; every period divides 900 so the
    // whole field of values returns to its frame-0 state at frame 900.
    const period = CELL_PERIODS[index % CELL_PERIODS.length];
    const phase = Math.floor(random(`phase:${index}`) * period);
    const cycles = DURATION / period;
    const epoch = Math.floor((s.frame + phase) / period) % cycles;
    return random(`cell:${index}:${epoch}`);
  }

  // "failing": bursts of rapid change separated by frozen stretches.
  const cycle = 130 + Math.floor(random(`fcyc:${index}`) * 120);
  const freeze = 30 + Math.floor(random(`ffrz:${index}`) * 31);
  const burst = 5 + Math.floor(random(`fbst:${index}`) * 10);
  const phase = Math.floor(random(`fpha:${index}`) * cycle);
  const t = (s.frame + phase) % cycle;
  const source = t < freeze ? s.frame - t : s.frame;
  return random(`cell:${index}:${Math.floor(source / burst)}`);
};

/* ================================================================== *
 * Seeded schedules built once per variant
 * ================================================================== */

const buildGlitchSchedule = (v: Variant, seed: string): GlitchEvent[] => {
  const g = v.glitch;
  const events: GlitchEvent[] = [];
  let f = Math.floor(g.gapMin * 0.6);
  let i = 0;
  while (f < DURATION) {
    const s = `${seed}:glitch${i}`;
    const dur = g.durMin + Math.floor(random(s + ":dur") * (g.durMax - g.durMin + 1));
    const sliceCount =
      g.sliceMin + Math.floor(random(s + ":n") * (g.sliceMax - g.sliceMin + 1));
    const slices: GlitchSlice[] = [];
    for (let k = 0; k < sliceCount; k++) {
      const ss = `${s}:slice${k}`;
      const dir = random(ss + ":dir") < 0.5 ? -1 : 1;
      slices.push({
        y: random(ss + ":y") * (FRAME_H - 40),
        h: 8 + random(ss + ":h") * 46,
        dx: dir * (g.shiftMin + random(ss + ":dx") * (g.shiftMax - g.shiftMin)),
      });
    }
    // A loop cannot have an event straddling the seam.
    if (!v.loops || f + dur <= DURATION) events.push({ start: f, dur, slices });

    const clustered = g.cluster > 0 && random(s + ":cl") < g.cluster;
    const gap = clustered
      ? Math.max(4, Math.round(g.gapMin * 0.3))
      : Math.round(g.gapMin + random(s + ":gap") * (g.gapMax - g.gapMin));
    f += gap;
    i++;
  }
  return events;
};

const activeGlitch = (s: Scene): GlitchEvent | null => {
  for (let i = 0; i < s.glitch.length; i++) {
    const e = s.glitch[i];
    if (s.frame >= e.start && s.frame < e.start + e.dur) return e;
  }
  return null;
};

const buildFragments = (seed: string): Fragment[] => {
  const out: Fragment[] = [];
  let t = random(`${seed}:frag:start`) * 0.1;
  let i = 0;
  // 6-9 disconnected arcs with widely varied lengths and generous gaps, so the
  // silhouette is implied rather than drawn.
  const target = 6 + Math.floor(random(`${seed}:frag:count`) * 4);
  while (t < 1 && i < target) {
    const s = `${seed}:frag${i}`;
    const stub = random(s + ":stub") < 0.4;
    const len = stub
      ? 0.008 + random(s + ":len") * 0.024
      : 0.055 + random(s + ":len2") * 0.105;
    out.push({
      t0: t,
      len,
      alpha: 0.45 + random(s + ":a") * 0.55,
      flickerPeriod: 60 + random(s + ":fp") * 150,
      flickerPhase: random(s + ":fh") * TAU,
      shiftGap: 34 + Math.floor(random(s + ":sg") * 90),
      shiftDur: 2 + Math.floor(random(s + ":sd") * 3),
      shiftAmount: (random(s + ":sa") < 0.5 ? -1 : 1) * (0.008 + random(s + ":sm") * 0.024),
    });
    t += len + 0.026 + random(s + ":gap") * 0.078;
    i++;
  }
  return out;
};

const buildFailureFrames = (
  count: number,
  poolSize: number,
  from: number,
  to: number,
  seed: string,
): number[] => {
  const out = new Array<number>(poolSize).fill(-1);
  const chosen = new Set<number>();
  let guard = 0;
  while (chosen.size < Math.min(count, poolSize) && guard < 200) {
    const idx = Math.floor(random(`${seed}:pick${guard}`) * poolSize) % poolSize;
    if (!chosen.has(idx)) {
      const k = chosen.size;
      chosen.add(idx);
      // Spread the failures evenly across the span, then jitter each one.
      const slot = from + ((to - from) * (k + 0.5)) / Math.max(1, count);
      out[idx] = Math.round(slot + (random(`${seed}:jit${idx}`) - 0.5) * 90);
    }
    guard++;
  }
  return out;
};

/* ================================================================== *
 * Offscreen textures. Each code panel and data card is laid out once and
 * then blitted; laying out panel text every frame at 4K is the expensive
 * mistake this avoids.
 * ================================================================== */

const cached = (s: Scene, key: string, build: () => HTMLCanvasElement) => {
  const hit = s.tex.get(key);
  if (hit) return hit;
  const made = build();
  s.tex.set(key, made);
  return made;
};

const buildPanelTexture = (s: Scene, spec: CodePanelSpec, garbled: boolean) => {
  const c = makeCanvas(Math.ceil(spec.w), Math.ceil(spec.h));
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const pad = spec.fontSize * 0.8;
  const lines = garbled ? spec.garbled : spec.lines;

  if (spec.framed) {
    ctx.strokeStyle = rgba(s.colors.panelDim, 0.85);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, c.width - 2, c.height - 2);
    ctx.fillStyle = rgba(s.colors.panelDim, 0.4);
    ctx.fillRect(1, 1, c.width - 2, spec.fontSize * 1.1);
  }

  ctx.textBaseline = "alphabetic";
  ctx.font = monoFont(spec.fontSize);
  const indentPx = ctx.measureText("  ").width;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let x = pad + line.indent * indentPx;
    const y = pad + spec.fontSize + i * spec.lineHeight;
    if (y > c.height) break;
    for (const tok of line.tokens) {
      ctx.fillStyle = rgba(toneRgb(s.colors, tok.tone), 0.92);
      ctx.fillText(tok.text, x, y);
      x += ctx.measureText(tok.text).width;
      if (x > c.width) break;
    }
  }
  return c;
};

const buildCardTexture = (s: Scene, spec: DataCardSpec) => {
  const c = makeCanvas(Math.ceil(spec.w), Math.ceil(spec.h));
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const r = spec.radius;

  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(spec.w, 0, spec.w, spec.h, r);
  ctx.arcTo(spec.w, spec.h, 0, spec.h, r);
  ctx.arcTo(0, spec.h, 0, 0, r);
  ctx.arcTo(0, 0, spec.w, 0, r);
  ctx.closePath();

  if (spec.filled) {
    ctx.fillStyle = rgba(s.colors.card, 0.55);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(s.colors.panelDim, spec.filled ? 0.9 : 1);
  ctx.lineWidth = 2.4;
  ctx.stroke();

  for (const l of spec.labels) {
    ctx.fillStyle = rgba(toneRgb(s.colors, l.tone), 0.5);
    ctx.fillRect(l.x, l.y, l.w, l.h);
  }
  return c;
};

const buildDotTile = (s: Scene) => {
  const size = 22;
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = rgba(s.colors.shieldFill, 1);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 3.2, 0, TAU);
  ctx.fill();
  return c;
};

const buildScanlineTile = (s: Scene) => {
  const c = makeCanvas(4, 5);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = rgba(s.colors.shieldHot, 1);
  ctx.fillRect(0, 0, 4, 1);
  return c;
};

const buildGrainTile = (s: Scene, index: number) => {
  const c = makeCanvas(GRAIN_TILE_PX, GRAIN_TILE_PX);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const img = ctx.createImageData(GRAIN_TILE_PX, GRAIN_TILE_PX);
  const d = img.data;
  for (let i = 0; i < GRAIN_TILE_PX * GRAIN_TILE_PX; i++) {
    const v = Math.floor(random(`grain:${index}:${i}`) * 256);
    d[i * 4] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/* ================================================================== *
 * Surround draw routines
 * ================================================================== */

const drawCodePanel = (s: Scene, spec: CodePanelSpec, index: number) => {
  const garbleFrom = s.garbleAt[index];
  const garbled = garbleFrom >= 0 && s.frame >= garbleFrom;
  const tex = cached(s, `${spec.id}:${garbled ? "g" : "n"}`, () =>
    buildPanelTexture(s, spec, garbled),
  );

  const bucket = bucketForDepth(spec.y);
  const layer = beginElement(s, bucket, true);
  const ctx = layer.ctx;
  const alpha = depthAlpha(spec.y, spec.opacity) * (bucket === "mid" ? 1 : 0.72);

  for (const t of TILE_INDICES) {
    const x = spec.x + t * TILE_W + s.tileShift + s.ambientX;
    if (!onScreen(x, spec.y, spec.w, spec.h)) continue;
    ctx.globalAlpha = alpha;
    ctx.drawImage(tex, spec.x + t * TILE_W, spec.y, spec.w, spec.h);
  }
  ctx.globalAlpha = 1;
};

const drawDataCard = (s: Scene, spec: DataCardSpec, index: number) => {
  const tex = cached(s, `${spec.id}:card`, () => buildCardTexture(s, spec));
  const bucket = bucketForDepth(spec.y);
  const layer = beginElement(s, bucket, true);
  const ctx = layer.ctx;

  const deadAt = s.darkAt[index];
  const dead = deadAt >= 0 && s.frame >= deadAt;
  const brightness = bucket === "mid" ? 1 : 1.15;
  const base = depthAlpha(spec.y, 0.9) * brightness * (dead ? 0.16 : 1);

  for (const t of TILE_INDICES) {
    const ox = spec.x + t * TILE_W;
    if (!onScreen(ox + s.tileShift + s.ambientX, spec.y, spec.w, spec.h)) continue;

    ctx.globalAlpha = Math.min(1, base);
    ctx.drawImage(tex, ox, spec.y, spec.w, spec.h);
    if (dead) continue;

    for (const row of spec.rows) {
      const jitter = row.cell >= 0 ? 0.55 + cellValue(s, row.cell) * 0.45 : 1;
      ctx.globalAlpha = Math.min(1, base * (row.cell >= 0 ? 0.95 : 0.75));
      ctx.fillStyle = rgba(toneRgb(s.colors, row.tone), 0.85);
      ctx.fillRect(ox + row.x, spec.y + row.y, row.w * jitter, row.h);
    }

    ctx.textBaseline = "alphabetic";
    for (const v of spec.values) {
      const val = cellValue(s, v.cell);
      const text = Math.floor(val * Math.pow(10, v.digits))
        .toString()
        .padStart(v.digits, "0");
      ctx.globalAlpha = Math.min(1, base);
      ctx.fillStyle = rgba(toneRgb(s.colors, v.tone), 0.95);
      ctx.font = monoFont(v.size, 500);
      ctx.fillText(text, ox + v.x, spec.y + v.y);
    }
  }
  ctx.globalAlpha = 1;
};

const drawRowStack = (s: Scene, spec: RowStackSpec) => {
  const bucket = bucketForDepth(spec.y);
  const layer = beginElement(s, bucket, true);
  const ctx = layer.ctx;
  const base = depthAlpha(spec.y, 0.8) * (bucket === "mid" ? 1 : 1.1);
  const gap = 26;

  for (const t of TILE_INDICES) {
    const ox = spec.x + t * TILE_W;
    if (!onScreen(ox + s.tileShift + s.ambientX, spec.y, 440, spec.rows.length * gap))
      continue;
    for (let i = 0; i < spec.rows.length; i++) {
      const row = spec.rows[i];
      const jitter = row.cell >= 0 ? 0.5 + cellValue(s, row.cell) * 0.5 : 1;
      ctx.globalAlpha = Math.min(1, base);
      ctx.fillStyle = rgba(toneRgb(s.colors, row.tone), 0.8);
      ctx.fillRect(ox, spec.y + i * gap, row.w * jitter, row.h);
    }
  }
  ctx.globalAlpha = 1;
};

const drawHighlights = (s: Scene) => {
  for (const bucket of ["far", "mid", "near"] as const) {
    const layer = beginElement(s, bucket, true);
    const ctx = layer.ctx;
    for (const p of s.surround.points) {
      if (bucketForDepth(p.y) !== bucket) continue;
      const twinkle =
        0.55 +
        0.45 * Math.sin(phaseOf(s.frame, DURATION / 4) + p.x * 0.01 + p.y * 0.013);
      const c = toneRgb(s.colors, p.tone);
      for (const t of TILE_INDICES) {
        const ox = p.x + t * TILE_W;
        if (!onScreen(ox + s.tileShift + s.ambientX, p.y, p.r * 2, p.r * 2, 60)) continue;
        ctx.globalAlpha = Math.min(1, depthAlpha(p.y, 0.9) * twinkle);
        ctx.fillStyle = rgba(c, 0.95);
        ctx.beginPath();
        ctx.arc(ox, p.y, p.r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = Math.min(1, depthAlpha(p.y, 0.22) * twinkle);
        ctx.beginPath();
        ctx.arc(ox, p.y, p.r * 3.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
};

/* ================================================================== *
 * The shield
 * ================================================================== */

const SHIELD_X = toLocalX(FRAME_W * SHIELD_ANCHOR_X, FRAME_H * SHIELD_ANCHOR_Y);
const SHIELD_Y = toLocalY(FRAME_W * SHIELD_ANCHOR_X, FRAME_H * SHIELD_ANCHOR_Y);

/**
 * The four-pass outline. A single thick semi-transparent stroke does not read
 * the same way: the wide atmospheric halo, the outer glow, the saturated mid
 * channel and the thin near-white core each do a different job.
 */
const fourPassGlow = (
  ctx: CanvasRenderingContext2D,
  trace: () => void,
  line: Rgb,
  hot: Rgb,
  blurScale: number,
  intensity: number,
) => {
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = rgba(line, 1);

  ctx.shadowBlur = 70 * blurScale;
  ctx.strokeStyle = rgba(line, 0.1 * intensity);
  ctx.lineWidth = 26;
  trace();
  ctx.stroke();

  ctx.shadowBlur = 30 * blurScale;
  ctx.strokeStyle = rgba(line, 0.3 * intensity);
  ctx.lineWidth = 15;
  trace();
  ctx.stroke();

  ctx.shadowBlur = 10 * blurScale;
  ctx.strokeStyle = rgba(line, 0.85 * intensity);
  ctx.lineWidth = 8;
  trace();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(hot, 0.95 * intensity);
  ctx.lineWidth = 5;
  trace();
  ctx.stroke();

  ctx.shadowColor = "transparent";
};

const drawInteriorDots = (s: Scene, ctx: CanvasRenderingContext2D) => {
  const tile = cached(s, "dotTile", () => buildDotTile(s));
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  const o = s.outline;
  const pulse = 1 + 0.1 * Math.sin(phaseOf(s.frame, DOT_PULSE_PERIOD));
  ctx.save();
  pathFull(ctx, o);
  ctx.clip();
  // Seat the interior so surround panels drifting behind the shield do not
  // compete with the dot texture for the eye.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = rgba(s.colors.backgroundDeep, 1);
  ctx.fillRect(-o.halfW - 20, -o.halfH - 40, o.halfW * 2 + 40, o.halfH * 2 + 80);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55 * pulse;
  ctx.fillStyle = pattern;
  ctx.fillRect(-o.halfW - 20, -o.halfH - 40, o.halfW * 2 + 40, o.halfH * 2 + 80);
  ctx.restore();
};

const drawSweep = (s: Scene, ctx: CanvasRenderingContext2D) => {
  const o = s.outline;
  const phase = (((s.frame % DURATION) / DURATION) * SWEEP_CIRCUITS) % 1;
  const steps = 12;
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.shadowColor = rgba(s.colors.shieldHot, 1);
  for (let i = 0; i < steps; i++) {
    const a = (i + 0.5) / steps;
    const intensity = Math.pow(Math.sin(Math.PI * a), 1.6);
    const t0 = phase + SWEEP_LENGTH * (i / steps);
    const t1 = t0 + (SWEEP_LENGTH / steps) * 1.25;
    ctx.shadowBlur = 44;
    ctx.strokeStyle = rgba(s.colors.shieldLine, 0.5 * intensity);
    ctx.lineWidth = 24;
    pathRange(ctx, o, t0, t1);
    ctx.stroke();
    ctx.shadowBlur = 16;
    ctx.strokeStyle = rgba(s.colors.shieldHot, 0.55 * intensity);
    ctx.lineWidth = 11;
    pathRange(ctx, o, t0, t1);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(s.colors.shieldHot, 1 * intensity);
    ctx.lineWidth = 6;
    pathRange(ctx, o, t0, t1);
    ctx.stroke();
  }
  ctx.shadowColor = "transparent";
};

const drawFragments = (s: Scene, ctx: CanvasRenderingContext2D) => {
  const o = s.outline;
  for (let i = 0; i < s.fragments.length; i++) {
    const f = s.fragments[i];
    const flicker =
      0.35 +
      0.65 * (0.5 + 0.5 * Math.sin(phaseOf(s.frame, f.flickerPeriod) + f.flickerPhase));
    // Segments slip along the path for a few frames at a time, so the
    // boundary never settles.
    const slipping = s.frame % f.shiftGap < f.shiftDur;
    const t0 = f.t0 + (slipping ? f.shiftAmount : 0);
    const trace = () => pathRange(ctx, o, t0, t0 + f.len);
    fourPassGlow(
      ctx,
      trace,
      s.colors.shieldLine,
      s.colors.shieldHot,
      1,
      f.alpha * flicker * 0.72,
    );
  }
};

const drawExclamation = (s: Scene, ctx: CanvasRenderingContext2D, intensity: number) => {
  const bar = () => pathExclamationBar(ctx, SHIELD_SCALE);
  const dot = () => pathExclamationDot(ctx, SHIELD_SCALE);
  fourPassGlow(ctx, bar, s.colors.shieldLine, s.colors.shieldHot, 1, intensity);
  fourPassGlow(ctx, dot, s.colors.shieldLine, s.colors.shieldHot, 1, intensity);

  const split = s.variant.glitch.channelSplitPx;
  const colors = s.variant.glitch.channelColors;
  if (split > 0 && colors && activeGlitch(s)) {
    const a = hexToRgb(colors[0]);
    const b = hexToRgb(colors[1]);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 6;
    for (const [col, dx] of [
      [a, split],
      [b, -split],
    ] as const) {
      ctx.strokeStyle = rgba(col, 0.85);
      ctx.save();
      ctx.translate(dx, 0);
      bar();
      ctx.stroke();
      dot();
      ctx.stroke();
      ctx.restore();
    }
  }
};

const drawShieldGlyph = (s: Scene) => {
  const layer = beginElement(s, "mid", false);
  const ctx = layer.ctx;
  ctx.save();
  ctx.translate(SHIELD_X, SHIELD_Y);

  const inverted = s.variant.shieldMode === "solidInverted";

  // THE BODY. "outlineGlow" is a lit shield containing a mark; "solidInverted"
  // reverses the figure and ground into a dark void with a burning mark inside
  // it -- filled solid and darker than the wash pooled behind it, so it reads
  // as a hole, with the dot texture removed entirely.
  if (inverted) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    pathFull(ctx, s.outline);
    ctx.fillStyle = rgba(s.colors.shieldFill, 1);
    ctx.fill();
  } else {
    drawInteriorDots(s, ctx);
  }

  // THE BOUNDARY, an independent axis: one closed unbroken path, or a handful
  // of disconnected arcs with gaps wide enough that the silhouette is only
  // implied.
  if (s.variant.outlineMode === "continuous") {
    fourPassGlow(
      ctx,
      () => pathFull(ctx, s.outline),
      s.colors.shieldLine,
      s.colors.shieldHot,
      1,
      inverted ? 0.7 : 1,
    );
    if (!inverted) drawSweep(s, ctx);
  } else {
    drawFragments(s, ctx);
  }

  // In the inverted mode the mark is the only thing that glows, and it is the
  // brightest element in the frame.
  drawExclamation(s, ctx, inverted ? 1.35 : 1);

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
};

/* ================================================================== *
 * Status words
 * ================================================================== */

const measureTracked = (
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
) => {
  const chars = text.split("");
  const widths: number[] = [];
  let total = tracking * (chars.length - 1);
  for (const ch of chars) {
    const w = ctx.measureText(ch).width;
    widths.push(w);
    total += w;
  }
  return { chars, widths, total };
};

/** Wide letterspacing, drawn glyph by glyph and centred on the origin. */
const drawTracked = (
  ctx: CanvasRenderingContext2D,
  m: ReturnType<typeof measureTracked>,
  tracking: number,
) => {
  let x = -m.total / 2;
  for (let i = 0; i < m.chars.length; i++) {
    ctx.fillText(m.chars[i], x, 0);
    x += m.widths[i] + tracking;
  }
};

const drawStatusWord = (s: Scene, w: WordSpec) => {
  const layer = beginElement(s, w.focus, false);
  const ctx = layer.ctx;
  const lx = toLocalX(w.sx * FRAME_W, w.sy * FRAME_H);
  const ly = toLocalY(w.sx * FRAME_W, w.sy * FRAME_H);

  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate((-w.rot * Math.PI) / 180);

  const breath =
    0.74 + 0.26 * Math.sin(phaseOf(s.frame, w.breathPeriod) + w.breathPhase);
  const alpha = w.alpha * breath;
  const col = w.tone === "wordPrimary" ? s.colors.wordPrimary : s.colors.wordAccent;
  const tracking = w.size * 0.19;

  ctx.font = displayFont(w.size, 700);
  ctx.textBaseline = "middle";
  const m = measureTracked(ctx, w.text, tracking);

  if (w.focus === "mid") {
    // A soft pool of background under the sharp instances, so the surround's
    // code texture never swallows the word it sits on.
    const rx = m.total * 0.68;
    const ry = w.size * 1.05;
    ctx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.scale(rx / ry, 1);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    pool.addColorStop(0, rgba(s.colors.backgroundDeep, 0.72));
    pool.addColorStop(0.55, rgba(s.colors.backgroundDeep, 0.42));
    pool.addColorStop(1, rgba(s.colors.backgroundDeep, 0));
    ctx.fillStyle = pool;
    ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
    ctx.restore();
  }

  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = rgba(col, 1);
  ctx.shadowBlur = w.size * 0.4 * layer.scale;
  ctx.fillStyle = rgba(col, alpha * 0.5);
  drawTracked(ctx, m, tracking);

  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.fillStyle = rgba(col, alpha);
  drawTracked(ctx, m, tracking);

  ctx.restore();
};

/* ================================================================== *
 * Frame assembly: background, depth composite, glitch, film finish
 * ================================================================== */

const prepareFrame = (s: Scene) => {
  resetLayer(s.layers.far);
  resetLayer(s.layers.mid);
  resetLayer(s.layers.near);

  const ctx = s.main;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = rgba(s.colors.backgroundDeep, 1);
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);

  const cx = toScreenX(SHIELD_X + s.ambientX, SHIELD_Y + s.ambientY);
  const cy = toScreenY(SHIELD_X + s.ambientX, SHIELD_Y + s.ambientY);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, FRAME_W * 0.62);
  g.addColorStop(0, rgba(s.colors.backgroundWash, s.variant.wash));
  g.addColorStop(0.45, rgba(s.colors.backgroundWash, s.variant.wash * 0.4));
  g.addColorStop(1, rgba(s.colors.backgroundWash, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);
};

/** Far to near, each buffer blurred exactly once. */
const compositeDepth = (s: Scene) => {
  const ctx = s.main;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  for (const b of ["far", "mid", "near"] as const) {
    const layer = s.layers[b];
    ctx.filter = layer.blurPx > 0 ? `blur(${layer.blurPx}px)` : "none";
    ctx.drawImage(layer.canvas, 0, 0, FRAME_W, FRAME_H);
  }
  ctx.filter = "none";
};

const drawGlitch = (s: Scene) => {
  const e = activeGlitch(s);
  if (!e) return;
  const ctx = s.main;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";

  s.scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
  s.scratchCtx.globalCompositeOperation = "copy";
  s.scratchCtx.drawImage(s.mainCanvas, 0, 0);

  for (const sl of e.slices) {
    const y = Math.round(sl.y);
    const h = Math.min(Math.round(sl.h), FRAME_H - y);
    if (h <= 0) continue;
    ctx.drawImage(s.scratch, 0, y, FRAME_W, h, Math.round(sl.dx), y, FRAME_W, h);
  }
};

const drawFilmFinish = (s: Scene) => {
  const ctx = s.main;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";

  const scan = ctx.createPattern(cached(s, "scanTile", () => buildScanlineTile(s)), "repeat");
  if (scan) {
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = scan;
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);
  }

  const idx = s.frame % GRAIN_TILES;
  const grain = ctx.createPattern(
    cached(s, `grainTile:${idx}`, () => buildGrainTile(s, idx)),
    "repeat",
  );
  if (grain) {
    const loopFrame = s.frame % DURATION;
    const ox = Math.floor(random(`grainOffX:${loopFrame}`) * GRAIN_TILE_PX);
    const oy = Math.floor(random(`grainOffY:${loopFrame}`) * GRAIN_TILE_PX);
    ctx.globalAlpha = 0.04;
    ctx.globalCompositeOperation = "overlay";
    ctx.translate(ox, oy);
    ctx.fillStyle = grain;
    ctx.fillRect(-ox, -oy, FRAME_W, FRAME_H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(
    FRAME_W / 2,
    FRAME_H / 2,
    FRAME_H * 0.24,
    FRAME_W / 2,
    FRAME_H / 2,
    FRAME_W * 0.72,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);
};

/* ================================================================== *
 * Components. Each pushes one ordered draw op; a single layout effect in
 * <ShieldStatus> runs the queue once per React render.
 * ================================================================== */

type Op = { scene: Scene };

export const CodePanel: React.FC<Op & { spec: CodePanelSpec; index: number }> = ({
  scene,
  spec,
  index,
}) => {
  scene.queue.push(() => drawCodePanel(scene, spec, index));
  return null;
};

export const DataCard: React.FC<Op & { spec: DataCardSpec; index: number }> = ({
  scene,
  spec,
  index,
}) => {
  scene.queue.push(() => drawDataCard(scene, spec, index));
  return null;
};

const RowStack: React.FC<Op & { spec: RowStackSpec }> = ({ scene, spec }) => {
  scene.queue.push(() => drawRowStack(scene, spec));
  return null;
};

const Highlights: React.FC<Op> = ({ scene }) => {
  scene.queue.push(() => drawHighlights(scene));
  return null;
};

export const ShieldGlyph: React.FC<Op> = ({ scene }) => {
  scene.queue.push(() => drawShieldGlyph(scene));
  return null;
};

export const StatusWord: React.FC<Op & { spec: WordSpec }> = ({ scene, spec }) => {
  scene.queue.push(() => drawStatusWord(scene, spec));
  return null;
};

const DepthComposite: React.FC<Op> = ({ scene }) => {
  scene.queue.push(() => compositeDepth(scene));
  return null;
};

export const GlitchPass: React.FC<Op> = ({ scene }) => {
  scene.queue.push(() => drawGlitch(scene));
  return null;
};

const FilmFinish: React.FC<Op> = ({ scene }) => {
  scene.queue.push(() => drawFilmFinish(scene));
  return null;
};

/* ================================================================== *
 * The composition
 * ================================================================== */

type Gfx = {
  mainCanvas: HTMLCanvasElement;
  main: CanvasRenderingContext2D;
  scratch: HTMLCanvasElement;
  scratchCtx: CanvasRenderingContext2D;
  layers: Record<Bucket, Layer>;
  tex: Map<string, HTMLCanvasElement>;
};

const createGfx = (): Gfx => {
  const mainCanvas = makeCanvas(FRAME_W, FRAME_H);
  const scratch = makeCanvas(FRAME_W, FRAME_H);
  return {
    mainCanvas,
    main: mainCanvas.getContext("2d") as CanvasRenderingContext2D,
    scratch,
    scratchCtx: scratch.getContext("2d") as CanvasRenderingContext2D,
    layers: {
      // Far and near are rendered at half resolution and blurred once each on
      // the way in; per-element blurring would be unusably slow at 4K.
      far: makeLayer(0.5, 24),
      mid: makeLayer(1, 0),
      near: makeLayer(0.5, 15),
    },
    tex: new Map(),
  };
};

const paletteRgb = (p: Palette): PaletteRgb => ({
  backgroundDeep: hexToRgb(p.backgroundDeep),
  backgroundWash: hexToRgb(p.backgroundWash),
  panelDim: hexToRgb(p.panelDim),
  codeA: hexToRgb(p.codeA),
  codeB: hexToRgb(p.codeB),
  codeC: hexToRgb(p.codeC),
  shieldLine: hexToRgb(p.shieldLine),
  shieldFill: hexToRgb(p.shieldFill),
  shieldHot: hexToRgb(p.shieldHot),
  wordPrimary: hexToRgb(p.wordPrimary),
  wordAccent: hexToRgb(p.wordAccent),
  card: hexToRgb(p.card),
});

const fontsAreReady = () =>
  typeof document !== "undefined" &&
  document.fonts.check(`400 20px "${MONO_FAMILY}"`) &&
  document.fonts.check(`700 20px "${DISPLAY_FAMILY}"`);

export const ShieldStatus: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const V = VARIANTS[variant];

  const gfxRef = useRef<Gfx | null>(null);
  if (gfxRef.current === null) gfxRef.current = createGfx();
  const gfx = gfxRef.current;

  const colors = useMemo(() => paletteRgb(V.palette), [V]);
  const surround = useMemo(() => buildSurround(`surround:${variant}`), [variant]);
  const outline = useMemo(() => buildShieldOutline(SHIELD_SCALE), []);
  const fragments = useMemo(() => buildFragments(`shield:${variant}`), [variant]);
  const glitch = useMemo(
    () => buildGlitchSchedule(V, `glitch:${variant}`),
    [V, variant],
  );
  const darkAt = useMemo(
    () =>
      V.failure
        ? buildFailureFrames(
            V.failure.darkCards,
            surround.cards.length,
            V.failure.fromFrame,
            V.failure.toFrame,
            `dark:${variant}`,
          )
        : new Array<number>(surround.cards.length).fill(-1),
    [V, surround.cards.length, variant],
  );
  const garbleAt = useMemo(
    () =>
      V.failure
        ? buildFailureFrames(
            V.failure.garbledPanels,
            surround.panels.length,
            V.failure.fromFrame,
            V.failure.toFrame,
            `garble:${variant}`,
          )
        : new Array<number>(surround.panels.length).fill(-1),
    [V, surround.panels.length, variant],
  );

  // Ambient drift: a closed path, +/-10px, every harmonic a divisor of 900.
  const t = (frame % DURATION) / DURATION;
  const ambientX =
    7 * Math.sin(phaseOf(frame, DURATION)) + 3 * Math.sin(phaseOf(frame, DURATION / 2) + 1.1);
  const ambientY =
    6 * Math.cos(phaseOf(frame, DURATION)) + 4 * Math.cos(phaseOf(frame, DURATION / 3) + 0.4);
  // The surround tiles along the plane's x axis and translates by exactly one
  // tile over the 900 frames, so the drift closes on itself.
  const tileShift = -t * TILE_W;

  const queue: DrawOp[] = [];
  const scene: Scene = {
    frame,
    variant: V,
    colors,
    surround,
    outline,
    fragments,
    glitch,
    darkAt,
    garbleAt,
    layers: gfx.layers,
    main: gfx.main,
    mainCanvas: gfx.mainCanvas,
    scratch: gfx.scratch,
    scratchCtx: gfx.scratchCtx,
    ambientX,
    ambientY,
    tileShift,
    queue,
    tex: gfx.tex,
  };

  useLayoutEffect(() => {
    const run = () => {
      prepareFrame(scene);
      for (const op of scene.queue) op();
    };
    if (fontsAreReady()) {
      run();
      return;
    }
    // Never capture a frame typeset in a fallback face: hold the frame, then
    // rebuild every cached texture once the real faces have arrived.
    const handle = delayRender("Typesetting the shield HUD");
    run();
    fontsLoaded
      .then(() => {
        scene.tex.clear();
        run();
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  });

  const attach = useCallback((el: HTMLDivElement | null) => {
    const canvas = gfxRef.current?.mainCanvas;
    if (el && canvas && el.firstChild !== canvas) el.appendChild(canvas);
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: V.palette.backgroundDeep }}>
      {surround.panels.map((spec, i) => (
        <CodePanel key={spec.id} scene={scene} spec={spec} index={i} />
      ))}
      {surround.cards.map((spec, i) => (
        <DataCard key={spec.id} scene={scene} spec={spec} index={i} />
      ))}
      {surround.stacks.map((spec) => (
        <RowStack key={spec.id} scene={scene} spec={spec} />
      ))}
      <Highlights scene={scene} />
      <ShieldGlyph scene={scene} />
      {V.words.map((spec, i) => (
        <StatusWord key={`${spec.text}-${i}`} scene={scene} spec={spec} />
      ))}
      <DepthComposite scene={scene} />
      <GlitchPass scene={scene} />
      <FilmFinish scene={scene} />
      <div
        ref={attach}
        style={{ width: "100%", height: "100%", lineHeight: 0 }}
      />
    </AbsoluteFill>
  );
};
