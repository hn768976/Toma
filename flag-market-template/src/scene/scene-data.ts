import { Easing } from "remotion";
import { COUNTRIES } from "../countries";
import { Direction, DIRECTIONS, ARROWS_END, ARROWS_START, LINE_END, LINE_START } from "../constants";
import { mulberry32 } from "../random";

// Everything random about a composition is generated here, ONCE, at module
// load, from mulberry32(seed, direction). Render code only reads it.
// Coordinates are normalised: x, y in 0–1 of the frame (y down).

export type LabelSpec = {
  index: number; // point index on the line
  value: string; // "46.72"
  pct: string; // "+2.31%"
  above: boolean;
  big: boolean;
  appearFrame: number;
};
export type ArrowSpec = { x: number; start: number; duration: number; size: number };
export type TickerRow = {
  y: number;
  fontSize: number; // px at 2160p
  speed: number; // px/frame at 2160p, signed
  blur: number; // px at 2160p
  opacity: number;
  text: string;
};
export type SceneData = {
  points: { x: number; y: number }[];
  labels: LabelSpec[];
  arrows: ArrowSpec[];
  rows: TickerRow[];
};

export const LINE_POINTS = 160;
export const lineEase = Easing.bezier(0.42, 0, 0.5, 1);
export const lineProgress = (frame: number) => {
  const t = Math.min(1, Math.max(0, (frame - LINE_START) / (LINE_END - LINE_START)));
  return lineEase(t);
};

const CODE_PREFIX = ["IDX", "SEC", "FND", "GRP", "SET", "LOT", "BLK", "SER", "UNT", "CMP", "BND", "MKT"];

const makeCode = (r: () => number) => {
  const p = CODE_PREFIX[Math.floor(r() * CODE_PREFIX.length)];
  const kind = r();
  if (kind < 0.6) return `${p}-${String(Math.floor(r() * 100)).padStart(2, "0")}`;
  if (kind < 0.8) return `${p}-${"ABCDEFGH"[Math.floor(r() * 8)]}`;
  return `${p}-${1 + Math.floor(r() * 9)}`;
};

const buildLine = (r: () => number, dir: Direction) => {
  const n = LINE_POINTS;
  // Random walk: fine zigzag + medium swings + rare jumps.
  const walk: number[] = [0];
  let momentum = 0;
  for (let i = 1; i < n; i++) {
    momentum = momentum * 0.7 + (r() - 0.5) * 1.1;
    // fine zigzag: consecutive steps tend to alternate in sign
    const zig = (i % 2 === 0 ? 1 : -1) * (0.2 + r() * 0.6);
    let step = momentum + zig + (r() - 0.5) * 1.2;
    if (r() < 0.07) step += (r() - 0.5) * 7;
    walk.push(walk[i - 1] + step);
  }
  // High-pass the walk (subtract a moving average) so it zigzags around
  // the trend instead of wandering off to one side, then add one or two
  // broad, realistic dips/bounces.
  const win = 18;
  const hp = walk.map((_, i) => {
    let sum = 0;
    let cnt = 0;
    for (let k = Math.max(0, i - win); k <= Math.min(n - 1, i + win); k++) {
      sum += walk[k];
      cnt++;
    }
    return walk[i] - sum / cnt;
  });
  const maxAbs = Math.max(...hp.map(Math.abs)) || 1;
  const phase = r() * Math.PI * 2;
  const waves = 1.2 + r() * 1.2;
  // value: 0 = bottom, 1 = top.
  const [from, to] = dir === "Up" ? [0.1, 0.9] : [0.9, 0.1];
  return hp.map((v, i) => {
    const t = i / (n - 1);
    const edge = Math.min(1, t * 6, (1 - t) * 6); // keep the ends on the trend
    const swing = Math.sin(t * Math.PI * 2 * waves + phase) * 0.09 * edge;
    const value = Math.min(0.98, Math.max(0.02, from + (to - from) * t + (v / maxAbs) * 0.17 + swing));
    return {
      x: -0.004 + t * 1.008,
      y: 0.9 - value * 0.78,
      value,
    };
  });
};

// Frame at which lineProgress first reaches p (search; runs at module load).
const frameForProgress = (p: number) => {
  for (let f = LINE_START; f <= LINE_END; f += 0.25) {
    if (lineProgress(f) >= p) return f;
  }
  return LINE_END;
};

// Approximate label boxes in 2160p px (mirrors LineChart's layout).
type Box = { x0: number; y0: number; x1: number; y1: number };
const labelBox = (p: { x: number; y: number }, above: boolean, big: boolean): Box => {
  const X = p.x * 3840;
  const Y = p.y * 2160;
  const fs = big ? 88 : 52;
  const w = fs * 0.62 * 6 + 40;
  const h = fs * 1.05 * 1.7 + 20;
  const cy = Y + (above ? -1 : 1) * (big ? 70 : 46);
  const flip = p.x > 0.86;
  const x0 = flip ? X - 26 - w : X - 20;
  const x1 = flip ? X + 20 : X + 26 + w;
  return { x0, x1, y0: Math.min(cy - h / 2, Y - 20), y1: Math.max(cy + h / 2, Y + 20) };
};
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const build = (seed: number, dir: Direction): SceneData => {
  const r = mulberry32(seed * 7919 + (dir === "Up" ? 101 : 202));
  const line = buildLine(r, dir);
  const n = line.length;
  const sign = dir === "Up" ? "+" : "−";

  // Labels: one per segment, snapped to the local peak/trough.
  const labelCount = 8;
  const labels: LabelSpec[] = [];
  const placed: Box[] = [];
  const bigOnes = new Set([2 + Math.floor(r() * 2), 5 + Math.floor(r() * 2)]);
  for (let k = 0; k < labelCount; k++) {
    // windows keep neighbouring labels >= 0.6 segment apart; peaks and
    // troughs alternate so neighbouring texts sit on opposite sides
    const lo = Math.floor(((k + 0.2) / labelCount) * n);
    const hi = Math.floor(((k + 0.8) / labelCount) * n);
    const wantPeak = k % 2 === 0;
    let best = lo;
    for (let i = lo; i < hi; i++) {
      if (wantPeak ? line[i].y < line[best].y : line[i].y > line[best].y) best = i;
    }
    const value = 38 + line[best].value * 30 + r() * 2;
    const pct = 0.35 + r() * 4.4;
    const big = bigOnes.has(k);
    const box = labelBox(line[best], wantPeak, big);
    // drop a label whose text box (or dot) would collide with the line's
    // other labels — keeps every label readable
    if (placed.some((p) => overlaps(p, box))) continue;
    placed.push(box);
    labels.push({
      index: best,
      value: value.toFixed(2),
      pct: `${sign}${pct.toFixed(2)}%`,
      above: wantPeak,
      big,
      appearFrame: frameForProgress((line[best].x + 0.004) / 1.008),
    });
  }

  // Arrows: 3–5, one at a time, at shuffled x positions.
  const count = 3 + Math.floor(r() * 3);
  const xs = Array.from({ length: count }, (_, i) => (i + 0.2 + r() * 0.6) / count);
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  const slot = (ARROWS_END - ARROWS_START) / count;
  const arrows: ArrowSpec[] = xs.map((x, i) => ({
    x: 0.06 + x * 0.88,
    start: ARROWS_START + i * slot + r() * slot * 0.12,
    duration: slot * (0.78 + r() * 0.1),
    size: 0.75 + r() * 0.45,
  }));

  // Ticker rows.
  const rowCount = 7;
  const rows: TickerRow[] = [];
  for (let i = 0; i < rowCount; i++) {
    const soft = i === 1 || i === 4 || (i === 6 && r() < 0.5);
    const items: string[] = [];
    for (let k = 0; k < 16; k++) {
      items.push(`${makeCode(r)}  ${(r() * 99).toFixed(2)}%`);
    }
    rows.push({
      y: (i + 0.5) / rowCount + (r() - 0.5) * 0.03,
      fontSize: soft ? 96 + r() * 18 : 62 + r() * 22,
      speed: (i % 2 === 0 ? -1 : 1) * (1.3 + r() * 2.4),
      blur: soft ? 4 + r() * 3 : 0,
      opacity: soft ? 0.36 : 0.46,
      text: items.join("     "),
    });
  }

  return { points: line.map(({ x, y }) => ({ x, y })), labels, arrows, rows };
};

export const SCENE_DATA: Record<string, SceneData> = {};
for (const c of COUNTRIES) {
  for (const d of DIRECTIONS) {
    SCENE_DATA[`${c.id}-${d}`] = build(c.seed, d);
  }
}
