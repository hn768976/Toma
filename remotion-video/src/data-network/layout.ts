// Deterministic placement of the HUD widgets across the board.
//
// The board is walked as a coarse grid; every slot that is not sitting on top
// of the continents gets one widget, sized and jittered from the slot's seed.

import { BOARD_H, BOARD_W, MAP_H, MAP_W, MAP_X, MAP_Y } from "./constants";
import type { ModuleName } from "./hud-modules";
import { hashSeed, intRange, mulberry32, range, type Rng } from "./rng";

type ModuleSpec = {
  /** Relative weight when picking a widget for a slot. */
  weight: number;
  /** Preferred width/height ratio. */
  aspect: number;
  /** Fraction of the slot the widget fills. */
  fill: [number, number];
};

const SPECS: Record<ModuleName, ModuleSpec> = {
  SpectrumBars: { weight: 10, aspect: 1.6, fill: [0.6, 0.85] },
  RainbowBars: { weight: 8, aspect: 1.5, fill: [0.55, 0.8] },
  DonutRow: { weight: 6, aspect: 2.6, fill: [0.6, 0.85] },
  TickStrip: { weight: 9, aspect: 6.5, fill: [0.75, 1.0] },
  BigDigits: { weight: 7, aspect: 2.8, fill: [0.5, 0.8] },
  MicroLines: { weight: 11, aspect: 1.7, fill: [0.55, 0.85] },
  PanelBox: { weight: 7, aspect: 1.25, fill: [0.6, 0.9] },
  SquareGrid: { weight: 8, aspect: 2.2, fill: [0.6, 0.9] },
  Sparkline: { weight: 6, aspect: 2.4, fill: [0.55, 0.85] },
  RadarDial: { weight: 4, aspect: 1, fill: [0.45, 0.7] },
  DigitStream: { weight: 9, aspect: 7.5, fill: [0.8, 1.0] },
  StackBars: { weight: 9, aspect: 1.5, fill: [0.55, 0.85] },
  GaugeArc: { weight: 4, aspect: 1, fill: [0.32, 0.5] },
  WaveForm: { weight: 7, aspect: 2.3, fill: [0.6, 0.9] },
};

const WEIGHTED: ModuleName[] = (
  Object.keys(SPECS) as ModuleName[]
).flatMap((name) => Array.from({ length: SPECS[name].weight }, () => name));

export type PlacedModule = {
  key: string;
  name: ModuleName;
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  opacity: number;
};

const COLS = 16;
const ROWS = 17;

/** Continents keep-out zone, as an ellipse in board space. */
const MAP_CX = MAP_X + MAP_W / 2;
const MAP_CY = MAP_Y + MAP_H / 2;
const KEEP_RX = MAP_W * 0.46;
const KEEP_RY = MAP_H * 0.56;

const insideMap = (x: number, y: number) =>
  ((x - MAP_CX) / KEEP_RX) ** 2 + ((y - MAP_CY) / KEEP_RY) ** 2 < 1;

const pickName = (rng: Rng, slotAspect: number): ModuleName => {
  // Sample a few candidates and keep whichever suits the slot's shape best.
  let best: ModuleName = WEIGHTED[0];
  let bestScore = Infinity;
  for (let i = 0; i < 4; i++) {
    const candidate = WEIGHTED[Math.floor(rng() * WEIGHTED.length)];
    const score = Math.abs(
      Math.log(SPECS[candidate].aspect) - Math.log(slotAspect),
    );
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
};

export const buildLayout = (): PlacedModule[] => {
  const slotW = BOARD_W / COLS;
  const slotH = BOARD_H / ROWS;
  const modules: PlacedModule[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const key = `m-${col}-${row}`;
      const seed = hashSeed(`data-network/${key}/v1`);
      const rng = mulberry32(seed);

      const cx = slotW * (col + 0.5);
      const cy = slotH * (row + 0.5);
      if (insideMap(cx, cy)) continue;

      // Leave a scattering of empty slots so the board breathes.
      if (rng() < 0.07) continue;

      const slotAspect = slotW / slotH;
      const name = pickName(rng, slotAspect);
      const spec = SPECS[name];
      const fill = range(rng, spec.fill[0], spec.fill[1]);

      let w = slotW * fill;
      let h = w / spec.aspect;
      if (h > slotH * 0.92) {
        h = slotH * range(rng, 0.5, 0.92);
        w = h * spec.aspect;
      }
      w = Math.min(w, slotW * 1.45);

      const jitterX = range(rng, -0.16, 0.16) * slotW;
      const jitterY = range(rng, -0.18, 0.18) * slotH;

      modules.push({
        key,
        name,
        x: cx - w / 2 + jitterX,
        y: cy - h / 2 + jitterY,
        w,
        h,
        seed: seed + intRange(rng, 0, 9999),
        opacity: range(rng, 0.62, 1),
      });
    }
  }

  return modules;
};

export type BoardLabel = {
  x: number;
  y: number;
  size: number;
  title: string;
  sub: string;
};

/** The handful of captions that are actually meant to be readable. */
export const BOARD_LABELS: readonly BoardLabel[] = [
  {
    x: MAP_X + MAP_W * 0.3,
    y: MAP_Y + MAP_H * 1.0,
    size: 42,
    title: "DATA SECTOR : 9073 93387-57",
    sub: "ANALYSIS DATA NODE",
  },
  {
    x: MAP_X + MAP_W * 0.58,
    y: MAP_Y + MAP_H * 1.16,
    size: 36,
    title: "BIG DATA : 5503 41-708",
    sub: "GLOBAL TRANSFER RATE 87.4%",
  },
  {
    x: MAP_X + MAP_W * 0.08,
    y: MAP_Y + MAP_H * 0.12,
    size: 33,
    title: "NETWORK LINK STATUS",
    sub: "NODES 39 / LINKS ACTIVE",
  },
  {
    x: MAP_X + MAP_W * 0.72,
    y: MAP_Y + MAP_H * 0.1,
    size: 33,
    title: "ANALYSIS DATA NODE : 6737",
    sub: "LAT/LON STREAM LOCKED",
  },
];
