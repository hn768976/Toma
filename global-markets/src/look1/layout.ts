import { LOOP } from "../common/constants";
import { mulberry32, periodicSeries } from "../common/random";

// ---------------------------------------------------------------------------
// Camera: closed path, everything a function of (frame % LOOP).
// World: map on the z = 0 plane, camera above looking down with a ~15° tilt.
// ---------------------------------------------------------------------------

export const FOV = 22; // vertical, degrees
export const TILT = (15 * Math.PI) / 180;
export const FOCUS = 15.2; // focus distance along the view axis (world units)
export const COC_K = 0.0062 * 2 * Math.tan(((FOV / 2) * Math.PI) / 180); // CoC radius in world units per unit |d - focus|
export const CAM_CENTER = { x: 0.6, y: 0.2 };
export const CAM_HEIGHT = 17;

export type CamState = {
  pos: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
};

export const cameraAt = (frame: number): CamState => {
  const t = ((frame % LOOP) + LOOP) % LOOP / LOOP;
  const a = 2 * Math.PI * t;
  const x = CAM_CENTER.x + 3.3 * Math.sin(a) + 0.45 * Math.sin(2 * a + 0.7);
  const y = CAM_CENTER.y + 0.6 * Math.sin(a + 1.9) + 0.15 * Math.cos(2 * a);
  const z = CAM_HEIGHT + 0.8 * Math.sin(a + 0.4);
  const yaw = 0.022 * Math.sin(a + 0.3); // radians
  const tilt = TILT + 0.025 * Math.sin(2 * a + 1.1);
  const reach = z * Math.tan(tilt);
  return {
    pos: [x, y, z],
    target: [x + Math.sin(yaw) * reach, y + Math.cos(yaw) * reach, 0],
    up: [-Math.sin(yaw), Math.cos(yaw), 0],
  };
};

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

export type WidgetType =
  | "panel"
  | "table"
  | "bars"
  | "area"
  | "line"
  | "percent"
  | "column"
  | "tag"
  | "candles"
  | "quad"
  | "ticker";

export type Widget = {
  id: number;
  type: WidgetType;
  x: number;
  y: number;
  z: number;
  w: number; // world width (without blur padding)
  h: number;
  lw: number; // logical (canvas design) width
  lh: number;
  pad: number; // world-unit blur padding on each side
  period: number; // frames per value tick (divides LOOP)
  n: number; // ticks per loop
  series: number[][]; // periodic arrays of length n (0..1)
  base: number; // magnitude of displayed numbers
  accent: "blue" | "green" | "red";
  framed: boolean; // translucent panel behind it
  variant: number; // small per-widget style switch
  flashes: number[]; // frames (0..LOOP) at which the widget flashes
  code: string; // invented label code
  maxScreenFrac: number; // widest on-screen width as a fraction of frame width
};

const SPEC: Record<WidgetType, { count: number; lw: number; lh: number; frac: [number, number] }> = {
  panel: { count: 5, lw: 340, lh: 300, frac: [0.12, 0.15] },
  table: { count: 7, lw: 250, lh: 190, frac: [0.06, 0.075] },
  bars: { count: 26, lw: 240, lh: 150, frac: [0.06, 0.09] },
  area: { count: 28, lw: 260, lh: 110, frac: [0.06, 0.1] },
  line: { count: 12, lw: 240, lh: 100, frac: [0.05, 0.07] },
  percent: { count: 18, lw: 230, lh: 230, frac: [0.07, 0.095] },
  column: { count: 30, lw: 150, lh: 230, frac: [0.03, 0.042] },
  tag: { count: 22, lw: 120, lh: 36, frac: [0.03, 0.04] },
  candles: { count: 4, lw: 240, lh: 120, frac: [0.05, 0.07] },
  quad: { count: 18, lw: 220, lh: 70, frac: [0.055, 0.07] },
  ticker: { count: 4, lw: 260, lh: 40, frac: [0.05, 0.065] },
};

const PERIODS = [6, 8, 10, 12, 15, 20, 24, 25, 30];

const ASPECT = 16 / 9;
const tanHalf = Math.tan(((FOV / 2) * Math.PI) / 180);
/** Visible frame width (world units) at view distance d. */
export const frameWidthAt = (d: number) => 2 * d * tanHalf * ASPECT;

const rand = mulberry32(0x5eed1777);
const R = (a: number, b: number) => a + (b - a) * rand();

// Camera samples for "where can a widget be seen" and min distance per widget.
const camSamples = Array.from({ length: 48 }, (_, i) => cameraAt((i * LOOP) / 48));
const camZMin = Math.min(...camSamples.map((c) => c.pos[2]));
const camZMax = Math.max(...camSamples.map((c) => c.pos[2]));

const buildWidgets = (): Widget[] => {
  const types: WidgetType[] = [];
  (Object.keys(SPEC) as WidgetType[]).forEach((t) => {
    for (let i = 0; i < SPEC[t].count; i++) types.push(t);
  });
  // deterministic shuffle
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  const placed: Widget[] = [];
  const zMin = 0.4;
  const zMax = 6.2;

  types.forEach((type, id) => {
    const spec = SPEC[type];
    // depth: favour far layers (area of the view footprint grows with distance²)
    let z = 0;
    for (;;) {
      z = R(zMin, zMax);
      const d = CAM_HEIGHT - z;
      if (rand() < (d * d) / (CAM_HEIGHT * CAM_HEIGHT)) break;
    }
    // the big panels sit in the near/mid layers
    // big panels: a defocused foreground layer close to the camera
    if (type === "panel") z = R(7.6, 9.4);
    const dRef = 15.5;
    const w = 0.95 * R(spec.frac[0], spec.frac[1]) * frameWidthAt(dRef);
    const h = (w * spec.lh) / spec.lw;

    // lateral region covered by the camera over the loop at this depth
    const dist = CAM_HEIGHT - z;
    const fw = frameWidthAt(dist);
    const fh = fw / ASPECT;
    const fwd = dist * Math.tan(TILT);
    const xs = camSamples.map((c) => c.pos[0]);
    const ys = camSamples.map((c) => c.pos[1] + fwd);
    const x0 = Math.min(...xs) - fw * 0.47;
    const x1 = Math.max(...xs) + fw * 0.47;
    const y0 = Math.min(...ys) - fh * 0.56;
    const y1 = Math.max(...ys) + fh * 0.56;

    // pick the least-overlapping of several candidate positions
    let best = { x: 0, y: 0, score: Infinity };
    for (let tries = 0; tries < 24; tries++) {
      const x = R(x0, x1);
      const y = R(y0, y1);
      let score = 0;
      for (const o of placed) {
        const od = CAM_HEIGHT - o.z;
        if (Math.abs(od - dist) > 2.2) continue;
        // compare in "screen" units (divide by distance)
        const ax = x / dist;
        const ay = y / dist;
        const bx = o.x / od;
        const by = o.y / od;
        const ox = Math.max(0, Math.min(ax + w / 2 / dist, bx + o.w / 2 / od) - Math.max(ax - w / 2 / dist, bx - o.w / 2 / od));
        const oy = Math.max(0, Math.min(ay + h / 2 / dist, by + o.h / 2 / od) - Math.max(ay - h / 2 / dist, by - o.h / 2 / od));
        score += ox * oy;
      }
      if (score < best.score) best = { x, y, score };
      if (score === 0) break;
    }

    const period = PERIODS[Math.floor(rand() * PERIODS.length)];
    const n = LOOP / period;
    const series = [0, 1, 2, 3].map(() => periodicSeries(rand, n, R(0.6, 1.4)));
    const accentRoll = rand();
    const accent = accentRoll < 0.68 ? "blue" : accentRoll < 0.84 ? "green" : "red";
    const flashes: number[] = [];
    if (rand() < 0.4) flashes.push(Math.floor(R(0, LOOP)));
    if (rand() < 0.15) flashes.push(Math.floor(R(0, LOOP)));

    const dMin = camZMin - z;
    const dMaxCoc = Math.max(Math.abs(camZMin - z - FOCUS), Math.abs(camZMax - z - FOCUS));
    const code = `${type === "ticker" || rand() < 0.5 ? "IDX" : "SEC"}-${type === "ticker" || rand() < 0.5 ? String(Math.floor(R(1, 99))).padStart(2, "0") : String.fromCharCode(65 + Math.floor(R(0, 26)))}`;

    placed.push({
      id,
      type,
      x: best.x,
      y: best.y,
      z,
      w,
      h,
      lw: spec.lw,
      lh: spec.lh,
      pad: COC_K * dMaxCoc * 1.05 + w * 0.01,
      period,
      n,
      series,
      base: Math.pow(10, R(1.2, 3.6)),
      accent,
      framed: type === "panel" ? true : type === "table" ? rand() < 0.5 : rand() < 0.15,
      variant: Math.floor(rand() * 4),
      flashes,
      code,
      maxScreenFrac: w / frameWidthAt(dMin),
    });
  });
  return placed;
};

export const WIDGETS: Widget[] = buildWidgets();
