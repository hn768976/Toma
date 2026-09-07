import {PLANE_H, PLANE_W} from './plane';
import type {Rng} from './rng';
import type {
  ContentKind,
  DensitySpec,
  LayoutName,
  Rect,
  Region,
  Scene,
  WebSpec,
} from './types';

/**
 * A layout is pure data: a list of regions with position, size and content
 * type, plus any node webs. The renderer walks the list and dispatches by
 * `kind`, so adding a seventh layout needs no new drawing code.
 */
export type LayoutBuilder = (rng: Rng, d: DensitySpec) => Scene;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const countFor = (base: number, d: DensitySpec, min = 2) =>
  Math.max(min, Math.round(base * d.countMul));

/** Content scale from a region's size, so big blocks are not just zoomed. */
const scaleFor = (w: number, h: number) =>
  clamp(Math.sqrt((w * h) / (980 * 620)), 0.68, 1.35);

const region = (r: Rect, kind: ContentKind): Region => ({
  ...r,
  kind,
  scale: scaleFor(r.w, r.h),
});

const vStack = (x: number, y: number, w: number, h: number, n: number, gutter: number): Rect[] => {
  const each = (h - gutter * (n - 1)) / n;
  return Array.from({length: n}, (_, i) => ({x, y: y + i * (each + gutter), w, h: each}));
};

const cells = (
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  gutter: number,
): Rect[] => {
  const cw = (w - gutter * (cols - 1)) / cols;
  const ch = (h - gutter * (rows - 1)) / rows;
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({x: x + c * (cw + gutter), y: y + r * (ch + gutter), w: cw, h: ch});
    }
  }
  return out;
};

/** Waveforms want a wide, short frame wherever they land. */
const normalise = (regions: Region[]): Region[] =>
  regions.map((r) => {
    if (r.kind !== 'waveform') return r;
    const h = Math.min(r.h, r.w * 0.34);
    return {...r, y: r.y + (r.h - h) / 2, h, scale: scaleFor(r.w, h)};
  });

const PANEL_KINDS: ContentKind[] = ['labelled', 'chart', 'table', 'waveform'];
const ALL_KINDS: ContentKind[] = ['binary', 'labelled', 'chart', 'table', 'waveform'];

const web = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  spread: number,
  nodes: number,
): WebSpec => ({ax, ay, bx, by, spread, nodes});

/** Large binary blocks left, node web through the centre, dense panels right. */
const leftBinary: LayoutBuilder = (rng, d) => {
  const g = d.gutter;
  const leftW = 2260;
  const rightX = 2860;
  const stack = vStack(0, -40, leftW, PLANE_H + 80, countFor(6, d, 3), g);
  const cols = countFor(3, d);
  const rows = countFor(5, d, 3);
  const right = cells(rightX, -40, PLANE_W - rightX, PLANE_H + 80, cols, rows, g * 0.8);
  const kinds: ContentKind[] = ['labelled', 'chart', 'labelled', 'table', 'chart', 'waveform'];
  return {
    regions: normalise([
      ...stack.map((r) => region(r, 'binary')),
      ...right.map((r, i) => region(r, kinds[i % kinds.length])),
    ]),
    webs: [web(2310, PLANE_H * 0.5, 2810, PLANE_H * 0.5, PLANE_H * 0.56, 16)],
  };
};

/** One tall centre column, binary left, charts right. The symmetrical layout. */
const centreStack: LayoutBuilder = (rng, d) => {
  const g = d.gutter;
  const left = {x: 0, w: 1450};
  const mid = {x: 1870, w: 1160};
  const right = {x: 3450, w: PLANE_W - 3450};
  const centre = vStack(mid.x, -50, mid.w, PLANE_H + 100, countFor(6, d), g * 0.7);
  const bins = vStack(left.x, -50, left.w, PLANE_H + 100, countFor(4, d), g);
  const rightN = countFor(4, d);
  const charts = vStack(right.x, -50, right.w, PLANE_H + 100, rightN, g);
  return {
    regions: normalise([
      ...bins.map((r) => region(r, 'binary')),
      ...centre.map((r) => region(r, 'labelled')),
      ...charts.map((r, i) => region(r, i % 3 === 2 ? 'waveform' : 'chart')),
    ]),
    webs: [
      web(1490, PLANE_H * 0.45, 1830, PLANE_H * 0.45, PLANE_H * 0.4, 10),
      web(3070, PLANE_H * 0.55, 3410, PLANE_H * 0.55, PLANE_H * 0.4, 10),
    ],
  };
};

/** Widely varying panel sizes across the whole plane, slightly overlapping. */
const scattered: LayoutBuilder = (rng, d) => {
  // Anchors on a loose 4x3 field, then sizes and offsets that vary widely —
  // distributed across the plane, but with no column structure left standing.
  const cols = 4;
  const rows = 3;
  const anchors = cells(-140, -120, PLANE_W + 280, PLANE_H + 240, cols, rows, 0);
  const extra = countFor(6, d, 2);
  const regions: Region[] = [];
  const place = (a: Rect) => {
    const wide = rng.bool(0.32);
    const w = rng.range(0.5, wide ? 1.75 : 1.3) * a.w;
    const h = rng.range(0.45, wide ? 0.95 : 1.55) * a.h;
    const x = a.x + a.w / 2 - w / 2 + rng.range(-0.34, 0.34) * a.w;
    const y = a.y + a.h / 2 - h / 2 + rng.range(-0.32, 0.32) * a.h;
    regions.push(region({x, y, w, h}, PANEL_KINDS[rng.weighted([0.34, 0.26, 0.24, 0.16])]));
  };
  for (const a of anchors) place(a);
  for (let i = 0; i < extra; i++) place(rng.pick(anchors));
  // Bigger panels first so the smaller ones sit over them.
  regions.sort((a, b) => b.w * b.h - a.w * a.h);
  const y = rng.range(0.3, 0.7) * PLANE_H;
  const x = rng.range(0.18, 0.42) * PLANE_W;
  return {
    regions: normalise(regions),
    webs: [web(x, y, x + rng.range(900, 1500), y + rng.range(-200, 200), PLANE_H * 0.42, 9)],
  };
};

/** A regular grid of equal panels — the monitoring wall. */
const grid: LayoutBuilder = (rng, d) => {
  const k = Math.sqrt(d.countMul);
  const cols = Math.max(3, Math.round(4 * k));
  const rows = Math.max(2, Math.round(3 * k));
  const g = d.gutter;
  const rects = cells(-60, -50, PLANE_W + 120, PLANE_H + 100, cols, rows, g);
  return {
    regions: normalise(
      rects.map((r, i) => region(r, ALL_KINDS[(i + Math.floor(i / cols)) % ALL_KINDS.length])),
    ),
    webs: [],
  };
};

/** A band from lower-left to upper-right; the corners stay dark. */
const diagonalFlow: LayoutBuilder = (rng, d) => {
  const n = countFor(24, d, 12);
  const ax = 0.02 * PLANE_W;
  const ay = 0.96 * PLANE_H;
  const bx = 0.98 * PLANE_W;
  const by = 0.04 * PLANE_H;
  const at = (t: number) => ({x: ax + (bx - ax) * t, y: ay + (by - ay) * t});
  const regions: Region[] = [];
  for (let i = 0; i < n; i++) {
    const t = clamp((i + 0.5) / n + rng.range(-0.022, 0.022), 0, 1);
    const c = at(t);
    const w = rng.range(0.12, 0.26) * PLANE_W;
    const h = rng.range(0.14, 0.31) * PLANE_H;
    // Offset perpendicular to the band so the flow is a band, not a line.
    const off = rng.range(-0.26, 0.26);
    const px = (by - ay);
    const py = -(bx - ax);
    const l = Math.hypot(px, py);
    regions.push(
      region(
        {
          x: c.x - w / 2 + (px / l) * off * PLANE_H,
          y: c.y - h / 2 + (py / l) * off * PLANE_H,
          w,
          h,
        },
        rng.weighted([0.2, 0.3, 0.24, 0.14, 0.12]) === 0
          ? 'binary'
          : rng.pick(PANEL_KINDS),
      ),
    );
  }
  const p1 = at(0.24);
  const p2 = at(0.42);
  const p3 = at(0.6);
  const p4 = at(0.78);
  return {
    regions: normalise(regions),
    webs: [
      web(p1.x, p1.y, p2.x, p2.y, PLANE_H * 0.2, 8),
      web(p3.x, p3.y, p4.x, p4.y, PLANE_H * 0.2, 8),
    ],
  };
};

/** Guillotine split of the whole plane — packed edge to edge, no empty ground. */
const dense: LayoutBuilder = (rng, d) => {
  const target = countFor(22, d, 10);
  const g = Math.max(6, d.gutter * 0.35);
  let rects: Rect[] = [{x: -60, y: -50, w: PLANE_W + 120, h: PLANE_H + 100}];
  while (rects.length < target) {
    rects.sort((a, b) => b.w * b.h - a.w * a.h);
    const r = rects.shift() as Rect;
    const splitVertical = r.w / r.h > rng.range(0.85, 1.25);
    const f = rng.range(0.36, 0.64);
    if (splitVertical) {
      const w1 = (r.w - g) * f;
      rects.push({x: r.x, y: r.y, w: w1, h: r.h});
      rects.push({x: r.x + w1 + g, y: r.y, w: r.w - w1 - g, h: r.h});
    } else {
      const h1 = (r.h - g) * f;
      rects.push({x: r.x, y: r.y, w: r.w, h: h1});
      rects.push({x: r.x, y: r.y + h1 + g, w: r.w, h: r.h - h1 - g});
    }
  }
  return {
    regions: normalise(
      rects.map((r) => region(r, ALL_KINDS[rng.weighted([0.22, 0.3, 0.2, 0.18, 0.1])])),
    ),
    webs: [],
  };
};

export const LAYOUTS: Record<LayoutName, LayoutBuilder> = {
  leftBinary,
  centreStack,
  scattered,
  grid,
  diagonalFlow,
  dense,
};

export const LAYOUT_NAMES = Object.keys(LAYOUTS) as LayoutName[];
