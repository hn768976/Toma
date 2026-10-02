// Style B schedule and background data, built ONCE per word at module load.
import { WORDS } from "../words";
import { int, mulberry32, range } from "../lib/random";

export const B_DURATION = 300;
export const ASSEMBLE_START = 20;
export const ASSEMBLE_END = 80;
export const LETTER_DURATION = 16; // frames for one letter to snap together
export const CLEAN_WINDOW: [number, number] = [190, 210];
export const PULLBACK_START = 80;
export const PULLBACK_AMOUNT = 0.08; // camera ends 8% further away (max 10%)

export const HEX = "0123456789ABCDEF";

export type Block = {
  // Rect of the letter's box, as fractions (0..1) of letter width / cap box
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  delay: number; // frames after the letter's start
  dx: number; // starting offset, in cap heights
  dy: number;
};
export type LetterAssembly = {
  start: number;
  blocks: Block[];
  redFlicker: boolean;
};
export type SliceGlitch = {
  start: number;
  len: number;
  v0: number; // band top, fraction of cap height (0 = top of caps)
  v1: number;
  dx: number; // fraction of cap height
};
export type Speck = {
  // stray glitch squares that fly around a letter while it assembles
  letter: number;
  u: number;
  v: number;
  size: number; // cap heights
  t0: number;
  len: number;
};
export type Layer = {
  font: number; // fraction of H
  cellX: number; // fraction of H
  lineH: number; // fraction of H
  blur: number; // fraction of H
  opacity: number;
  speed: number; // fraction of H per frame
  density: number;
  depth: number; // parallax factor for the camera pull-back
  color: string;
  key: number;
};
export type Bokeh = {
  x: number;
  y: number;
  r: number; // fraction of H
  color: string;
  opacity: number;
  ax: number;
  wx: number;
  vy: number;
  phase: number;
  depth: number;
};
export type RainSchedule = {
  letters: LetterAssembly[];
  slices: SliceGlitch[];
  specks: Speck[];
  layers: Layer[];
  bokeh: Bokeh[];
  textureKey: number;
  lines: { v: number; h: number; bright: boolean }[]; // thin texture slices
};

const overlaps = (s: number, len: number, w: [number, number]) =>
  s <= w[1] && s + len - 1 >= w[0];

export const buildRainSchedule = (seed: number, word: string): RainSchedule => {
  const rng = mulberry32(seed);
  const chars = [...word];
  const n = chars.length;
  // Left to right: letter i starts at a fixed stagger, last one done by 80.
  const step = n > 1 ? (ASSEMBLE_END - ASSEMBLE_START - LETTER_DURATION) / (n - 1) : 0;
  const letters: LetterAssembly[] = chars.map((_, i) => {
    const blocks: Block[] = [];
    const cols = 3;
    const rows = 5;
    for (let a = 0; a < cols; a++)
      for (let b = 0; b < rows; b++)
        blocks.push({
          u0: a / cols,
          u1: (a + 1) / cols,
          v0: b / rows,
          v1: (b + 1) / rows,
          delay: int(rng, 0, 6),
          dx: range(rng, -1.1, 1.1),
          dy: range(rng, -0.7, 0.7),
        });
    return {
      start: Math.round(ASSEMBLE_START + i * step),
      blocks,
      redFlicker: rng() < 0.45,
    };
  });

  const specks: Speck[] = [];
  letters.forEach((l, i) => {
    for (let k = 0; k < 6; k++)
      specks.push({
        letter: i,
        u: range(rng, -0.8, 1.8),
        v: range(rng, -0.6, 1.6),
        size: range(rng, 0.04, 0.14),
        t0: l.start + int(rng, 0, 8),
        len: int(rng, 2, 5),
      });
  });

  const slices: SliceGlitch[] = [];
  for (let f = ASSEMBLE_END + int(rng, 15, 30); f < B_DURATION - 3; ) {
    const len = int(rng, 2, 4);
    if (!overlaps(f, len, CLEAN_WINDOW)) {
      const v0 = range(rng, -0.05, 0.9);
      slices.push({
        start: f,
        len,
        v0,
        v1: v0 + range(rng, 0.04, 0.16),
        dx: range(rng, -0.12, 0.12),
      });
    }
    f += len + int(rng, 25, 45);
  }

  // Four depths: far = small & sharp ... near = large & blurred.
  const layers: Layer[] = [
    { font: 0.0105, cellX: 0.0165, lineH: 0.022, blur: 0, opacity: 0.5, speed: 0.0004, density: 0.42, depth: 0.55, color: "#2f6fd8", key: 0 },
    { font: 0.016, cellX: 0.027, lineH: 0.034, blur: 0.0008, opacity: 0.6, speed: 0.0008, density: 0.32, depth: 0.75, color: "#3d86ff", key: 0 },
    { font: 0.029, cellX: 0.052, lineH: 0.058, blur: 0.0028, opacity: 0.55, speed: 0.0014, density: 0.16, depth: 1.0, color: "#4a90ff", key: 0 },
    { font: 0.062, cellX: 0.11, lineH: 0.115, blur: 0.008, opacity: 0.42, speed: 0.0024, density: 0.09, depth: 1.4, color: "#5b9bff", key: 0 },
  ].map((l) => ({ ...l, key: int(rng, 1, 1e9) }));

  const bokeh: Bokeh[] = Array.from({ length: 80 }, () => {
    const big = rng() < 0.35;
    return {
      x: range(rng, -0.05, 1.05),
      y: range(rng, -0.05, 1.05),
      r: big ? range(rng, 0.012, 0.03) : range(rng, 0.002, 0.007),
      color: rng() < 0.6 ? "#9fd2ff" : rng() < 0.5 ? "#ffffff" : "#6fe6ff",
      opacity: big ? range(rng, 0.12, 0.3) : range(rng, 0.4, 0.85),
      ax: range(rng, 0.002, 0.012),
      wx: range(rng, 0.008, 0.03),
      vy: range(rng, 0.0001, 0.0006),
      phase: range(rng, 0, Math.PI * 2),
      depth: big ? 1.4 : 0.8,
    };
  });

  const lines = Array.from({ length: 9 }, () => ({
    v: range(rng, 0, 1),
    h: range(rng, 0.008, 0.025),
    bright: rng() < 0.3,
  }));

  return { letters, slices, specks, layers, bokeh, textureKey: int(rng, 1, 1e9), lines };
};

export const RAIN_SCHEDULES = new Map<number, RainSchedule>(
  WORDS.filter((w) => w.style === "DataRain").map((w) => [w.seed, buildRainSchedule(w.seed, w.word)]),
);
