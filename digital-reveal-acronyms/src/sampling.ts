import { CAP_FRAC, PARTICLE_COUNT } from "./config";
import { FONT_FAMILY, FONT_WEIGHT } from "./font";
import { hashString, mulberry32 } from "./random";

// Word geometry, all in "N units": fractions of frame height, origin at the
// frame centre, +y down. Built once per word (after the font has loaded) by
// drawing the word into a hidden canvas and sampling its pixels.
export type WordData = {
  word: string;
  fontSizeN: number;
  // Horizontal shift applied to the text anchor so the ink is centred.
  xShiftN: number;
  baselineN: number;
  bbox: { left: number; right: number; top: number; bottom: number };
  // PARTICLE_COUNT target points (x, y pairs), denser along the letter edges.
  targets: Float32Array;
  // Circuit-trace polylines that start on a letter edge and leave the word.
  circuits: { points: [number, number][]; length: number }[];
};

const REF_H = 1000;
const REF_W = Math.round((REF_H * 16) / 9);
const EDGE_SHARE = 0.5;

const cache = new Map<string, WordData>();

export const sampleWord = (word: string): WordData => {
  const hit = cache.get(word);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = REF_W;
  canvas.height = REF_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  // Font size that gives the requested cap height (measured on "H").
  ctx.font = `${FONT_WEIGHT} 100px ${FONT_FAMILY}`;
  const capRatio = ctx.measureText("H").actualBoundingBoxAscent / 100;
  const fontSize = (CAP_FRAC * REF_H) / capRatio;
  // Centre the cap height vertically; lowercase shares the same baseline.
  const baseline = REF_H / 2 + (CAP_FRAC * REF_H) / 2;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.fillText(word, REF_W / 2, baseline);

  const { data } = ctx.getImageData(0, 0, REF_W, REF_H);
  const inside = new Uint8Array(REF_W * REF_H);
  for (let i = 0; i < inside.length; i++) inside[i] = data[i * 4 + 3] > 127 ? 1 : 0;

  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= REF_W || y >= REF_H ? 0 : inside[y * REF_W + x];

  const interior: number[] = [];
  const edges: number[] = [];
  let left = REF_W, right = 0, top = REF_H, bottom = 0;
  for (let y = 0; y < REF_H; y++) {
    for (let x = 0; x < REF_W; x++) {
      if (!at(x, y)) continue;
      const idx = y * REF_W + x;
      interior.push(idx);
      // Edge band ~2px wide.
      let edge = false;
      for (let d = 1; d <= 2 && !edge; d++) {
        if (!at(x - d, y) || !at(x + d, y) || !at(x, y - d) || !at(x, y + d)) edge = true;
      }
      if (edge) edges.push(idx);
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (interior.length === 0) throw new Error(`Word "${word}" rendered no pixels`);

  // Centre the visible ink, not the advance width: side bearings would
  // otherwise push words like "AI" a few pixels off centre.
  const inkShift = REF_W / 2 - (left + right + 1) / 2;
  const toN = (px: number, py: number): [number, number] => [
    (px + inkShift - REF_W / 2) / REF_H,
    (py - REF_H / 2) / REF_H,
  ];

  const rng = mulberry32(hashString(word) ^ 0xa5a5a5a5);
  const targets = new Float32Array(PARTICLE_COUNT * 2);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const list = rng() < EDGE_SHARE ? edges : interior;
    const idx = list[Math.floor(rng() * list.length)];
    const [nx, ny] = toN((idx % REF_W) + rng(), Math.floor(idx / REF_W) + rng());
    targets[i * 2] = nx;
    targets[i * 2 + 1] = ny;
  }

  // Exposed edges per column / row, so traces never cross a letter.
  const colTop = new Int32Array(REF_W).fill(-1);
  const colBottom = new Int32Array(REF_W).fill(-1);
  for (let x = left; x <= right; x++) {
    for (let y = top; y <= bottom; y++) if (at(x, y)) { colTop[x] = y; break; }
    for (let y = bottom; y >= top; y--) if (at(x, y)) { colBottom[x] = y; break; }
  }
  const rowLeft = new Int32Array(REF_H).fill(-1);
  const rowRight = new Int32Array(REF_H).fill(-1);
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) if (at(x, y)) { rowLeft[y] = x; break; }
    for (let x = right; x >= left; x--) if (at(x, y)) { rowRight[y] = x; break; }
  }

  const cRng = mulberry32(hashString(word) ^ 0x51c0ffee);
  // Only start traces where the letter edge is near the word's outer edge, so
  // a trace never runs up through a notch (M), mouth (C) or counter.
  const nearEdge = 0.12 * (bottom - top);
  const pickCol = (lo: number, hi: number, arr: Int32Array, dir: number) => {
    for (let k = 0; k < 300; k++) {
      const x = Math.floor(lo + cRng() * (hi - lo));
      if (arr[x] < 0) continue;
      if (dir < 0 ? arr[x] - top <= nearEdge : bottom - arr[x] <= nearEdge) return x;
    }
    return -1;
  };
  const circuits: WordData["circuits"] = [];
  const addPath = (pts: [number, number][]) => {
    const n = pts.map(([x, y]) => toN(x, y));
    let len = 0;
    for (let i = 1; i < n.length; i++) len += Math.abs(n[i][0] - n[i - 1][0]) + Math.abs(n[i][1] - n[i - 1][1]);
    circuits.push({ points: n, length: len });
  };
  const span = right - left;
  const H = REF_H;
  // Up and down traces, spread across the word in slots.
  const slots = 4;
  for (let s = 0; s < slots; s++) {
    const lo = left + (span * s) / slots;
    const hi = left + (span * (s + 1)) / slots;
    for (const dir of [-1, 1] as const) {
      const arr = dir < 0 ? colTop : colBottom;
      const x = pickCol(lo, hi, arr, dir);
      if (x < 0) continue;
      const y0 = arr[x];
      const yEdge = dir < 0 ? top : bottom;
      const y1 = yEdge + dir * H * (0.025 + cRng() * 0.05);
      const side = x < REF_W / 2 ? -1 : 1;
      const x2 = x + side * H * (0.04 + cRng() * 0.09);
      const pts: [number, number][] = [[x, y0], [x, y1], [x2, y1]];
      if (cRng() < 0.5) pts.push([x2, y1 + dir * H * (0.015 + cRng() * 0.03)]);
      addPath(pts);
    }
  }
  // One trace off each side.
  for (const side of [-1, 1] as const) {
    const arr = side < 0 ? rowLeft : rowRight;
    let y = -1;
    for (let k = 0; k < 200 && y < 0; k++) {
      const c = Math.floor(top + (0.2 + cRng() * 0.6) * (bottom - top));
      if (arr[c] >= 0) y = c;
    }
    if (y < 0) continue;
    const x0 = arr[y];
    const x1 = (side < 0 ? left : right) + side * H * (0.03 + cRng() * 0.04);
    const vdir = cRng() < 0.5 ? -1 : 1;
    const y2 = y + vdir * H * (0.03 + cRng() * 0.04);
    addPath([[x0, y], [x1, y], [x1, y2], [x1 + side * H * (0.03 + cRng() * 0.05), y2]]);
  }

  const [l, t] = toN(left, top);
  const [r, b] = toN(right + 1, bottom + 1);
  const result: WordData = {
    word,
    fontSizeN: fontSize / REF_H,
    xShiftN: inkShift / REF_H,
    baselineN: (baseline - REF_H / 2) / REF_H,
    bbox: { left: l, right: r, top: t, bottom: b },
    targets,
    circuits,
  };
  cache.set(word, result);
  return result;
};
