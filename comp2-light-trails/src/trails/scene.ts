import { createRandom } from "./random";

/**
 * Procedural light-painting scene. All geometry is generated once from a fixed
 * seed in a resolution-independent space (x in [0, 16], y in [0, 9]) and every
 * frame is a pure function of time, so frames can be rendered in any order or
 * in parallel and still be identical.
 */

export type Pt = { x: number; y: number };

export type TrailKind = "squiggle" | "fine" | "hero" | "bokeh";

export type Trail = {
  kind: TrailKind;
  points: Pt[];
  /** Cumulative arc length at each point. */
  lengths: number[];
  birth: number; // seconds
  drawDur: number; // time for the head to sweep the full path
  hold: number;
  fade: number;
  width: number; // in scene units (1 unit = 1/9 of frame height)
  intensity: number;
  dash: number; // 0 = solid, otherwise dash period in scene units
  flickerSeed: number;
  blur: number; // extra softness (scene units) for out-of-focus streaks
};

export const SCENE_W = 16;
export const SCENE_H = 9;

const gauss = (rnd: () => number) => {
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * Loop length. The reference is a seamless loop, so every time-dependent
 * function here is periodic in LOOP seconds (250 frames @ 30 fps).
 */
export const LOOP = 250 / 30;
const TAU = Math.PI * 2;
const per = (cycles: number, t: number, phase: number) =>
  Math.sin((TAU * cycles * t) / LOOP + phase);

/** Wandering cluster centres where most of the light painting happens. */
export const clusterCenter = (k: number, t: number): Pt => {
  const params = [
    { ax: 2.6, ay: 1.4, nx: 1, ny: 2, px: 0.4, py: 1.3, cx: 8.2, cy: 4.2 },
    { ax: 3.4, ay: 1.8, nx: 2, ny: 1, px: 2.6, py: 0.2, cx: 9.8, cy: 4.7 },
    { ax: 4.6, ay: 2.0, nx: 1, ny: 1, px: 4.4, py: 3.1, cx: 8.9, cy: 4.4 },
  ][k % 3];
  return {
    x: params.cx + params.ax * per(params.nx, t, params.px),
    y: params.cy + params.ay * per(params.ny, t, params.py),
  };
};

/** Dominant stroke direction: broadly diagonal, swinging slowly over the loop. */
export const flowAngle = (t: number) => -0.32 + 0.38 * per(1, t, 0.7) + 0.15 * per(3, t, 2.1);

type WalkOptions = {
  start: Pt;
  heading: number;
  length: number;
  step: number;
  curlSigma: number; // curvature randomness (tangle)
  curlDamp: number;
  jitterAmp: number; // hand-tremor amplitude
  jitterFreq: number;
  kinkRate?: number; // probability per step of an abrupt direction change
  kinkMax?: number; // largest kink angle (radians)
};

const randomWalk = (rnd: () => number, o: WalkOptions) => {
  const pts: Pt[] = [];
  let x = o.start.x;
  let y = o.start.y;
  let h = o.heading;
  let k = 0;
  const n = Math.max(2, Math.round(o.length / o.step));
  const f1 = o.jitterFreq * (0.7 + rnd() * 0.6);
  const f2 = o.jitterFreq * (2.1 + rnd() * 1.4);
  const p1 = rnd() * 10;
  const p2 = rnd() * 10;
  // Hand tremor: band-limited random offset perpendicular to the stroke,
  // mixing a slow sway with irregular fast shakes.
  let fast = 0;
  let slow = 0;
  const kf = Math.exp(-o.step * o.jitterFreq);
  const ks = Math.exp(-o.step * o.jitterFreq * 0.25);
  for (let i = 0; i < n; i++) {
    const s = i * o.step;
    fast = fast * kf + gauss(rnd) * Math.sqrt(1 - kf * kf);
    slow = slow * ks + gauss(rnd) * Math.sqrt(1 - ks * ks);
    const j =
      o.jitterAmp *
      (fast * 0.75 + slow * 0.9 + Math.sin(s * f1 + p1) * 0.15 + Math.sin(s * f2 + p2) * 0.08);
    pts.push({ x: x - Math.sin(h) * j, y: y + Math.cos(h) * j });
    k = k * o.curlDamp + gauss(rnd) * o.curlSigma;
    if (o.kinkRate && rnd() < o.kinkRate) {
      h += (rnd() < 0.5 ? -1 : 1) * (0.15 + rnd() * (o.kinkMax ?? 1.2));
    }
    h += k * o.step;
    x += Math.cos(h) * o.step;
    y += Math.sin(h) * o.step;
  }
  return pts;
};

const cumulative = (pts: Pt[]) => {
  const out = [0];
  for (let i = 1; i < pts.length; i++) {
    out.push(out[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return out;
};

const startNear = (rnd: () => number, t: number, spread: number): Pt => {
  if (rnd() < 0.14) {
    return { x: rnd() * SCENE_W, y: rnd() * SCENE_H };
  }
  const c = clusterCenter(Math.floor(rnd() * 3), t);
  return { x: c.x + gauss(rnd) * spread, y: c.y + gauss(rnd) * spread * 0.8 };
};

const pickHeading = (rnd: () => number, t: number) => {
  const r = rnd();
  const base = flowAngle(t) + (rnd() < 0.5 ? 0 : Math.PI);
  if (r < 0.72) return base + gauss(rnd) * 0.35; // with the flow
  if (r < 0.88) return base + Math.PI / 2 + gauss(rnd) * 0.25; // cross strokes
  return rnd() * TAU;
};

export const buildScene = (seed = 7): Trail[] => {
  const rnd = createRandom(seed);
  const trails: Trail[] = [];

  // Births are spread over one loop; trailState() wraps ages modulo LOOP so
  // strokes born near the end continue seamlessly into frame 0.
  const spawn = (rate: number, make: (birth: number) => Trail) => {
    const n = Math.round(rate * LOOP);
    for (let i = 0; i < n; i++) {
      trails.push(make(((i + rnd()) / n) * LOOP));
    }
  };

  // 1. Main strands: bright, jagged, lightning-like hand-painted strokes that
  //    flash in within a few frames and die quickly.
  spawn(80, (birth) => {
    const pts = randomWalk(rnd, {
      start: startNear(rnd, birth, 1.25),
      heading: pickHeading(rnd, birth),
      length: 1.5 + rnd() * 6,
      step: 0.022,
      curlSigma: 0.25 + Math.pow(rnd(), 5) * 4,
      curlDamp: 0.95,
      jitterAmp: 0.008 + Math.pow(rnd(), 2) * 0.03,
      jitterFreq: 12 + rnd() * 22,
      kinkRate: 0.05,
      kinkMax: 0.75,
    });
    return {
      kind: "squiggle",
      points: pts,
      lengths: cumulative(pts),
      birth,
      drawDur: 0.03 + rnd() * 0.1,
      hold: 0.03 + rnd() * 0.2,
      fade: 0.08 + rnd() * 0.25,
      width: 0.01 + Math.pow(rnd(), 2) * 0.03,
      intensity: 0.85 + rnd() * 0.55,
      dash: 0,
      flickerSeed: rnd() * 100,
      blur: 0,
    };
  });

  // 2. Fine, dim, often dotted filaments forming the background web.
  spawn(60, (birth) => {
    const pts = randomWalk(rnd, {
      start: startNear(rnd, birth, 1.9),
      heading: pickHeading(rnd, birth),
      length: 1.5 + rnd() * 6,
      step: 0.022,
      curlSigma: 0.4 + Math.pow(rnd(), 4) * 5,
      curlDamp: 0.95,
      jitterAmp: 0.008 + rnd() * 0.03,
      jitterFreq: 10 + rnd() * 20,
      kinkRate: 0.05,
      kinkMax: 0.9,
    });
    return {
      kind: "fine",
      points: pts,
      lengths: cumulative(pts),
      birth,
      drawDur: 0.04 + rnd() * 0.12,
      hold: 0.1 + rnd() * 0.3,
      fade: 0.15 + rnd() * 0.3,
      width: 0.006 + rnd() * 0.006,
      intensity: 0.4 + rnd() * 0.5,
      dash: rnd() < 0.6 ? 0.025 + rnd() * 0.04 : 0,
      flickerSeed: rnd() * 100,
      blur: 0,
    };
  });

  // 3. Hero streaks: thick, very bright, fast and short-lived (lights swept
  //    close to the lens), slightly out of focus.
  spawn(18, (birth) => {
    const pts = randomWalk(rnd, {
      start: startNear(rnd, birth, 2.4),
      heading: pickHeading(rnd, birth),
      length: 2 + rnd() * 5,
      step: 0.05,
      curlSigma: 0.01 + rnd() * 0.1,
      curlDamp: 0.97,
      jitterAmp: 0.008,
      jitterFreq: 5,
    });
    return {
      kind: "hero",
      points: pts,
      lengths: cumulative(pts),
      birth,
      drawDur: 0.02 + rnd() * 0.05,
      hold: 0.01 + rnd() * 0.04,
      fade: 0.04 + rnd() * 0.08,
      width: 0.2 + rnd() * 0.4,
      intensity: 1.0 + rnd() * 0.3,
      dash: 0,
      flickerSeed: rnd() * 100,
      blur: 0.03 + rnd() * 0.05,
    };
  });

  // 4. Bokeh blobs: bright soft dots that blink in and out.
  spawn(5, (birth) => {
    const c = startNear(rnd, birth, 2.2);
    const len = rnd() * 0.3;
    const a = rnd() * TAU;
    const pts = [c, { x: c.x + Math.cos(a) * len + 1e-3, y: c.y + Math.sin(a) * len }];
    return {
      kind: "bokeh",
      points: pts,
      lengths: cumulative(pts),
      birth,
      drawDur: 0.04,
      hold: 0.03 + rnd() * 0.08,
      fade: 0.08 + rnd() * 0.12,
      width: 0.1 + rnd() * 0.2,
      intensity: 0.9 + rnd() * 0.3,
      dash: 0,
      flickerSeed: rnd() * 100,
      blur: 0.03 + rnd() * 0.04,
    };
  });

  return trails;
};

/** Visibility of a trail at time t: head progress (0..1) and opacity. */
export const trailState = (tr: Trail, t: number) => {
  const age = (((t - tr.birth) % LOOP) + LOOP) % LOOP;
  const total = tr.drawDur + tr.hold + tr.fade;
  if (age > total) return null;
  const head = Math.min(1, age / tr.drawDur);
  const fadeT = Math.max(0, (age - tr.drawDur - tr.hold) / tr.fade);
  const fadeIn = Math.min(1, age / 0.04);
  const flicker = 0.62 + 0.38 * per(97, t, tr.flickerSeed) * per(29, t, tr.flickerSeed * 2);
  const alpha = tr.intensity * fadeIn * Math.pow(1 - fadeT, 1.4) * flicker;
  return alpha > 0.003 ? { head, alpha } : null;
};
