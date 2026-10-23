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
  // Motion is expressed in whole cycles per clip so the clip loops
  // seamlessly, like the reference.
  waveCycles: number;
  phase: number;
  driftX: number;
  driftY: number;
  spin: number;
  breatheCycles: number;
};

const SHAPES = ["eight", "eight", "eight", "hook", "hook", "loop", "coil", "wavy"] as const;
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
      // Two opposite turns spanning almost the whole filament trace a
      // figure-eight with short tails.
      return [
        { s0: range(rng, 0.04, 0.08), len: range(rng, 0.42, 0.46), turn: sign * range(rng, 5.0, 5.8), breathe: 0.12 },
        { s0: range(rng, 0.5, 0.53), len: range(rng, 0.42, 0.46), turn: -sign * range(rng, 5.0, 5.8), breathe: 0.12 },
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
  waveAmp: shape === "wavy" ? range(rng, 1.4, 2.2) : shape === "eight" ? range(rng, 0.2, 0.45) : range(rng, 0.45, 1.0),
  waveK: range(rng, 0.8, 1.6),
  waveCycles: (2 + Math.floor(rng() * 4)) * (rng() < 0.5 ? -1 : 1),
  phase: range(rng, 0, Math.PI * 2),
  driftX: range(rng, -22, 22),
  driftY: range(rng, -22, 22),
  spin: range(rng, -0.18, 0.18),
  breatheCycles: 2 + Math.floor(rng() * 4),
});

export const createWorms = (seed: number): Worm[] => {
  const rng = mulberry32(seed);
  const worms: Worm[] = [];

  // Background (behind the focal plane) — soft, slightly larger.
  for (let i = 0; i < 7; i++) {
    worms.push(
      makeWorm(rng, range(rng, 0, DESIGN_W), range(rng, 0, DESIGN_H), range(rng, 260, 380), range(rng, 13, 17), 1),
    );
  }

  // Main field: a loose jittered grid; the reference is clumpy rather than
  // even, so many cells are skipped and the rest pushed around generously.
  const cols = 9;
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.3) continue;
      const cx = ((c + 0.5) / cols) * DESIGN_W + range(rng, -110, 110);
      const cy = ((r + 0.5) / rows) * DESIGN_H + range(rng, -80, 80);
      // Leave the middle for the tangled central cluster.
      if (Math.abs(cx - 1000) < 200 && Math.abs(cy - 540) < 260) continue;
      const big = rng() < 0.22;
      worms.push(
        makeWorm(rng, cx, cy, big ? range(rng, 420, 560) : range(rng, 270, 400), big ? range(rng, 15, 18) : range(rng, 11, 14), 0),
      );
    }
  }

  // Denser patches toward the bottom and right, as in the reference.
  for (const [px, py] of [
    [1380, 900],
    [1720, 640],
    [560, 1010],
    [1620, 1030],
  ]) {
    for (let i = 0; i < 3; i++) {
      worms.push(
        makeWorm(rng, px + range(rng, -90, 90), py + range(rng, -60, 60), range(rng, 260, 380), range(rng, 11, 13.5), 0),
      );
    }
  }

  // Central tangle: a few long, thick hooked filaments knotting together.
  const center: Shape[] = ["hook", "eight", "hook", "wavy"];
  center.forEach((shape, i) => {
    const w = makeWorm(rng, 990 + range(rng, -70, 70), 540 + range(rng, -90, 90), range(rng, 560, 720), range(rng, 18, 22), 0, shape);
    w.heading = -Math.PI / 2 + range(rng, -0.45, 0.45) + (i % 2 ? Math.PI : 0);
    w.waveAmp = range(rng, 0.6, 1.0);
    w.waveCycles = Math.sign(w.waveCycles) * 2;
    w.driftX *= 0.5;
    w.driftY *= 0.5;
    w.spin *= 0.5;
    worms.push(w);
  });

  // Out-of-focus foreground filaments at the bottom edge.
  for (const [fx, fy, len] of [
    [820, 1070, 330],
    [330, 1085, 300],
    [1870, 980, 340],
  ]) {
    worms.push(makeWorm(rng, fx, fy, len, range(rng, 22, 28), 2, "hook"));
  }

  return worms;
};

const POINTS = 72;

// Builds the centerline by integrating curvature along the arc length.
// Time drives a travelling curvature wave (the wriggle) and a slow
// "breathing" of the bends so loops tighten and relax.
// `cycle` runs 0 → 2π over the whole clip; every motion term is periodic
// in it so the last frame flows back into the first.
export const wormPath = (w: Worm, cycle: number): Float32Array => {
  const pts = new Float32Array(POINTS * 2);
  const ds = w.length / (POINTS - 1);
  let heading = w.heading + w.spin * Math.sin(cycle + w.phase);
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
      Math.sin(Math.PI * 2 * w.waveK * s - w.waveCycles * cycle + w.phase);
    for (const b of w.bends) {
      const u = (s - b.s0) / b.len;
      if (u > 0 && u < 1) {
        const breathe = 1 + b.breathe * Math.sin(w.breatheCycles * cycle + w.phase);
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
  const ox = w.x + w.driftX * Math.sin(cycle + w.phase * 1.3) - cx;
  const oy = w.y + w.driftY * Math.cos(cycle + w.phase * 0.7) - cy;
  for (let i = 0; i < POINTS; i++) {
    pts[i * 2] += ox;
    pts[i * 2 + 1] += oy;
  }
  return pts;
};
