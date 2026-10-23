import { mulberry32, pick, range, Rng } from "./random";

// All geometry lives in a 1920x1080 design space; the renderer scales it to
// the composition size (3840x2160 for the 4K masters).
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

// A localized bend along the filament: `turn` radians of extra heading are
// accumulated between s0 and s0 + len (fractions of the filament length).
// This is what produces the hooks, "6" curls and closed "8" loops.
type Bend = { s0: number; len: number; turn: number; breathe: number };

export type Worm = {
  x: number;
  y: number;
  heading: number;
  length: number;
  width: number;
  // 0 = in the focal plane, 1 = behind (soft), 2 = in front of it (very soft).
  layer: 0 | 1 | 2;
  bends: Bend[];
  waveAmp: number;
  waveK: number;
  waveSpeed: number;
  phase: number;
  driftX: number;
  driftY: number;
  spin: number;
  breatheSpeed: number;
};

const SHAPES = ["hook", "loop", "loop", "eight", "eight", "coil", "hook", "wavy"] as const;
type Shape = (typeof SHAPES)[number];

const makeBends = (rng: Rng, shape: Shape): Bend[] => {
  const sign = rng() < 0.5 ? -1 : 1;
  switch (shape) {
    case "hook":
      return [
        { s0: range(rng, 0.4, 0.48), len: range(rng, 0.5, 0.58), turn: sign * range(rng, 4.6, 6.2), breathe: 0.16 },
      ];
    case "loop":
      return [
        { s0: range(rng, 0.15, 0.35), len: range(rng, 0.55, 0.65), turn: sign * range(rng, 6.0, 6.8), breathe: 0.1 },
      ];
    case "eight":
      return [
        { s0: range(rng, 0.06, 0.1), len: 0.42, turn: sign * range(rng, 5.8, 6.5), breathe: 0.1 },
        { s0: range(rng, 0.5, 0.54), len: 0.42, turn: -sign * range(rng, 5.8, 6.5), breathe: 0.1 },
      ];
    case "coil":
      return [
        { s0: range(rng, 0.3, 0.38), len: range(rng, 0.6, 0.68), turn: sign * range(rng, 10, 12.5), breathe: 0.08 },
      ];
    case "wavy":
      return [];
  }
};

const makeWorm = (
  rng: Rng,
  x: number,
  y: number,
  length: number,
  width: number,
  layer: Worm["layer"],
  shape: Shape = pick(rng, SHAPES),
): Worm => ({
  x,
  y,
  heading: range(rng, 0, Math.PI * 2),
  length,
  width,
  layer,
  bends: makeBends(rng, shape),
  waveAmp: shape === "wavy" ? range(rng, 1.4, 2.2) : range(rng, 0.45, 1.0),
  waveK: range(rng, 0.8, 1.6),
  waveSpeed: range(rng, 0.22, 0.5) * (rng() < 0.5 ? -1 : 1),
  phase: range(rng, 0, Math.PI * 2),
  driftX: range(rng, -2.2, 2.2),
  driftY: range(rng, -2.2, 2.2),
  spin: range(rng, -0.018, 0.018),
  breatheSpeed: range(rng, 0.25, 0.6),
});

export const createWorms = (seed: number): Worm[] => {
  const rng = mulberry32(seed);
  const worms: Worm[] = [];

  // Background (behind the focal plane) — soft, slightly larger.
  for (let i = 0; i < 9; i++) {
    worms.push(
      makeWorm(rng, range(rng, 0, DESIGN_W), range(rng, 0, DESIGN_H), range(rng, 160, 260), range(rng, 9, 12), 1),
    );
  }

  // Main field: jittered grid keeps the even scatter of the reference.
  const cols = 11;
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = ((c + 0.5) / cols) * DESIGN_W + range(rng, -70, 70);
      const cy = ((r + 0.5) / rows) * DESIGN_H + range(rng, -55, 55);
      // Leave the middle for the tangled central cluster.
      if (Math.abs(cx - 1000) < 170 && Math.abs(cy - 560) < 210) continue;
      const big = rng() < 0.18;
      worms.push(
        makeWorm(rng, cx, cy, big ? range(rng, 260, 380) : range(rng, 130, 240), big ? range(rng, 8.5, 10.5) : range(rng, 6.5, 8.5), 0),
      );
    }
  }

  // Dense patches near the lower edge, like the tangles in the reference.
  for (const [px, py] of [
    [1360, 880],
    [560, 1000],
    [1520, 1020],
    [180, 1040],
  ]) {
    for (let i = 0; i < 4; i++) {
      worms.push(
        makeWorm(rng, px + range(rng, -80, 80), py + range(rng, -50, 50), range(rng, 120, 210), range(rng, 6.5, 8.5), 0),
      );
    }
  }

  // Central tangle: a few long, thick filaments overlapping each other.
  const center: Shape[] = ["hook", "loop", "wavy", "eight", "hook", "loop"];
  center.forEach((shape, i) => {
    const w = makeWorm(rng, 990 + range(rng, -110, 110), 560 + range(rng, -130, 130), range(rng, 420, 600), range(rng, 12, 15), 0, shape);
    w.heading = -Math.PI / 2 + range(rng, -0.5, 0.5) + (i % 2 ? Math.PI : 0);
    w.waveAmp = range(rng, 0.8, 1.4);
    w.driftX *= 0.4;
    w.driftY *= 0.4;
    worms.push(w);
  });

  // Out-of-focus foreground filaments at the bottom edge.
  for (const [fx, fy, len] of [
    [820, 1070, 230],
    [330, 1085, 200],
    [1870, 980, 240],
  ]) {
    worms.push(makeWorm(rng, fx, fy, len, range(rng, 16, 20), 2, "hook"));
  }

  return worms;
};

const POINTS = 72;

// Builds the centerline by integrating curvature along the arc length.
// Time drives a travelling curvature wave (the wriggle) and a slow
// "breathing" of the bends so loops tighten and relax.
export const wormPath = (w: Worm, t: number): Float32Array => {
  const pts = new Float32Array(POINTS * 2);
  const ds = w.length / (POINTS - 1);
  let heading = w.heading + w.spin * t;
  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < POINTS; i++) {
    const s = i / (POINTS - 1);
    pts[i * 2] = x;
    pts[i * 2 + 1] = y;
    cx += x;
    cy += y;

    let k =
      ((w.waveAmp * Math.PI * 2) / w.length) *
      Math.sin(Math.PI * 2 * (w.waveK * s - w.waveSpeed * t) + w.phase);
    for (const b of w.bends) {
      const u = (s - b.s0) / b.len;
      if (u > 0 && u < 1) {
        const breathe = 1 + b.breathe * Math.sin(t * w.breatheSpeed * Math.PI * 2 + w.phase);
        const window = 2 * Math.sin(Math.PI * u) ** 2;
        k += ((b.turn * breathe) / (b.len * w.length)) * window;
      }
    }
    heading += k * ds;
    x += Math.cos(heading) * ds;
    y += Math.sin(heading) * ds;
  }
  cx /= POINTS;
  cy /= POINTS;
  const ox = w.x + w.driftX * t - cx;
  const oy = w.y + w.driftY * t - cy;
  for (let i = 0; i < POINTS; i++) {
    pts[i * 2] += ox;
    pts[i * 2 + 1] += oy;
  }
  return pts;
};
