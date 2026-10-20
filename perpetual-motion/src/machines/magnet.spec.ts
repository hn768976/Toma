// John Wilkins' magnetic ramp (Mathematical Magick, 1648/1670): a lodestone on a
// pillar draws an iron ball up an inclined ramp; near the top the ball drops
// through a hole onto a curved return chute that carries it back to the foot
// of the ramp, to be drawn up again. World units are centimetres, z up.
//
// The ball's path is one closed curve: ramp → ballistic drop → chute → J-curl
// → ramp. Everything below the hole is simulated as real physics: a ballistic
// fall, a small bounce on landing, rolling at 5/7 g with rolling resistance
// down the chute and over the J-curl. The climb is the design's impossible
// claim, so it follows a speed profile shaped like a lodestone's pull: gravity
// slows the ball off the J-curl, while the pull, growing as the ball nears the
// stone (∝ (d₀/d)²), draws it on ever faster to the hole. The pull's scale is solved
// (scripts/tune-magnet.mjs) so the whole cycle lasts exactly 10 s, and the
// ball leaves the J-curl at exactly the speed the climb starts with.

import { catmull, type V3 } from "../lib/curve.ts";

export type { V3 };

export const RAMP = {
  ball: 5,
  slope: 18,
  /** ball centre where the J-curl hands over to the ramp */
  start: [103.09, 0, 29.51] as V3,
  holeX: -40,
  holeHalf: 9,
  holeHalfWidth: 7.5,
  topX: -58,
  plankWidth: 24,
  plankThickness: 3.2,
  magnet: [-78, 0, 88] as V3,
  /** how fast the J-curl's speed decays on the climb, and how steeply the pull grows */
  decay: 14,
  pullPower: 2,
  chuteResistance: 0.08,
  /** solved by scripts/tune-magnet.mjs */
  crawl: 5.285340405629844,
  /** the cycle (natural 6.5 s) plays over 300 frames: the same physics on a machine ~2.4× this size */
  period: 10,
};

const deg = Math.PI / 180;
export const DIR: V3 = [-Math.cos(RAMP.slope * deg), 0, Math.sin(RAMP.slope * deg)];
/** ball centre on the ramp at distance u from the start */
export const rampAt = (u: number): V3 => [RAMP.start[0] + DIR[0] * u, 0, RAMP.start[2] + DIR[2] * u];
/** distance along the ramp where the ball's centre passes the hole's near edge */
export const EDGE_U = (RAMP.start[0] - (RAMP.holeX + RAMP.holeHalf)) / Math.cos(RAMP.slope * deg);
export const TOP_U = (RAMP.start[0] - RAMP.topX) / Math.cos(RAMP.slope * deg);

// ---- the chute: a Catmull–Rom curve through control points, then the J-curl

const CHUTE_CONTROL: V3[] = [
  [-58, 0, 46],
  [-40, 0, 40],
  [-24, 1, 34.6],
  [-8, 7, 30.5],
  [6, 20, 27],
  [30, 30, 22],
  [56, 30, 17],
  [78, 22, 13],
  [92, 8, 10.6],
  [100, 0, 10],
];

function jCurl(): V3[] {
  // a vertical half-loop in the x–z plane: centre (100, 0, 20), radius 10,
  // from the bottom (heading +x) round to 72°, where it heads up the ramp
  const out: V3[] = [];
  for (let i = 1; i <= 60; i++) {
    const phi = (-90 + (162 * i) / 60) * deg;
    out.push([100 + 10 * Math.cos(phi), 0, 20 + 10 * Math.sin(phi)]);
  }
  return out;
}

export const CHUTE: V3[] = [...catmull(CHUTE_CONTROL, 24), ...jCurl()];
export const J_START = CHUTE.length - 61;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

export const CHUTE_S: number[] = (() => {
  const s = [0];
  for (let i = 1; i < CHUTE.length; i++) s.push(s[i - 1] + len(sub(CHUTE[i], CHUTE[i - 1])));
  return s;
})();
export const CHUTE_LENGTH = CHUTE_S[CHUTE_S.length - 1];

export function chuteAt(s: number): { p: V3; t: V3; i: number } {
  const x = Math.min(CHUTE_LENGTH, Math.max(0, s));
  let lo = 0;
  let hi = CHUTE_S.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (CHUTE_S[mid] <= x) lo = mid;
    else hi = mid;
  }
  const f = (x - CHUTE_S[lo]) / (CHUTE_S[hi] - CHUTE_S[lo] || 1);
  const a = CHUTE[lo];
  const b = CHUTE[hi];
  const d = sub(b, a);
  const n = len(d) || 1;
  return { p: [a[0] + d[0] * f, a[1] + d[1] * f, a[2] + d[2] * f], t: [d[0] / n, d[1] / n, d[2] / n], i: lo };
}

/** The rail frame along the chute: lateral (horizontal, continuous) and the track normal (toward the ball). */
export const CHUTE_FRAME: { lat: V3; up: V3 }[] = (() => {
  const out: { lat: V3; up: V3 }[] = [];
  let prev: V3 = [0, 1, 0];
  for (let i = 0; i < CHUTE.length; i++) {
    const a = CHUTE[Math.max(0, i - 1)];
    const b = CHUTE[Math.min(CHUTE.length - 1, i + 1)];
    const d = sub(b, a);
    const n = len(d) || 1;
    const t: V3 = [d[0] / n, d[1] / n, d[2] / n];
    const h = Math.hypot(t[0], t[1]);
    let lat: V3 = h > 0.2 ? [-t[1] / h, t[0] / h, 0] : prev;
    if (lat[0] * prev[0] + lat[1] * prev[1] + lat[2] * prev[2] < 0) lat = [-lat[0], -lat[1], -lat[2]];
    prev = lat;
    // up = t × lat, signed so it points up on the open chute
    let up: V3 = [t[1] * lat[2] - t[2] * lat[1], t[2] * lat[0] - t[0] * lat[2], t[0] * lat[1] - t[1] * lat[0]];
    if (i === 0 && up[2] < 0) up = [-up[0], -up[1], -up[2]];
    if (out.length && up[0] * out[out.length - 1].up[0] + up[1] * out[out.length - 1].up[1] + up[2] * out[out.length - 1].up[2] < 0) up = [-up[0], -up[1], -up[2]];
    out.push({ lat, up });
  }
  return out;
})();

// ---- the simulation ----------------------------------------------------------

const G = 981;
const ROLL = 5 / 7;

export type Phase = "ramp" | "air" | "chute";
export interface Sample {
  p: V3;
  phase: Phase;
  /** chute arc length (chute phase) */
  s: number;
}

export interface Cycle {
  samples: Sample[];
  dt: number;
  T: number;
  vEnd: number;
  minRampSpeed: number;
  ok: boolean;
}

/** Chute height at x on the straight lead-in under the hole (for the landing). */
function chuteZAtX(x: number) {
  for (let i = 1; i < CHUTE.length; i++) {
    if (CHUTE[i][0] >= x) {
      const a = CHUTE[i - 1];
      const b = CHUTE[i];
      const f = (x - a[0]) / (b[0] - a[0]);
      return { z: a[2] + (b[2] - a[2]) * f, s: CHUTE_S[i - 1] + (CHUTE_S[i] - CHUTE_S[i - 1]) * f, i };
    }
  }
  return { z: CHUTE[0][2], s: 0, i: 1 };
}

/** Speed on the climb at distance u, starting from v0 off the J-curl. */
const distToMagnet = (u: number) => {
  const p = rampAt(u);
  return Math.hypot(p[0] - RAMP.magnet[0], p[2] - RAMP.magnet[2]);
};
const D0 = distToMagnet(0);
/** Speed on the climb at distance u, starting from v0 off the J-curl; `crawl` scales the pull. */
export function climbSpeed(u: number, v0: number, crawl: number) {
  const pull = crawl * Math.pow(D0 / distToMagnet(u), RAMP.pullPower);
  return pull + (v0 - crawl) * Math.exp(-u / RAMP.decay);
}

export function simulate(crawl: number, v0: number, dt = 1 / 3000): Cycle {
  const chuteResistance = RAMP.chuteResistance;
  const samples: Sample[] = [];
  let phase: Phase = "ramp";
  let u = 0;
  let v = v0;
  let pos: V3 = rampAt(0);
  let vel: V3 = [0, 0, 0];
  let s = 0;
  let hop = 0;
  let hopV = 0;
  let minRampSpeed = Infinity;
  let t = 0;
  for (let step = 0; step < 200000; step++) {
    if (phase === "ramp") {
      pos = rampAt(u);
      samples.push({ p: pos, phase, s: 0 });
      v = climbSpeed(u, v0, crawl);
      minRampSpeed = Math.min(minRampSpeed, v);
      u += v * dt;
      if (u >= EDGE_U) {
        phase = "air";
        pos = rampAt(u);
        // tipping over the edge, the ball leaves level: its climb along the slope is spent
        vel = [DIR[0] * v, 0, 0];
      }
    } else if (phase === "air") {
      samples.push({ p: pos, phase, s: 0 });
      vel = [vel[0], 0, vel[2] - G * dt];
      pos = [pos[0] + vel[0] * dt, 0, pos[2] + vel[2] * dt];
      const ground = chuteZAtX(pos[0]);
      if (pos[2] <= ground.z) {
        // land: keep the tangential speed (less a little), bounce on the normal
        const c = chuteAt(ground.s);
        const vt = vel[0] * c.t[0] + vel[2] * c.t[2];
        const vn = Math.abs(vel[0] * CHUTE_FRAME[c.i].up[0] + vel[2] * CHUTE_FRAME[c.i].up[2]);
        // a curved catch under the hole turns the fall along the chute, keeping
        // most of the speed; a little of the impact comes back as a hop
        void vt;
        v = Math.hypot(vel[0], vel[2]) * 0.8;
        hopV = vn * 0.1;
        hop = 0;
        s = ground.s;
        phase = "chute";
      }
    } else {
      const c = chuteAt(s);
      const up = CHUTE_FRAME[c.i].up;
      pos = [c.p[0] + up[0] * hop, c.p[1] + up[1] * hop, c.p[2] + up[2] * hop];
      samples.push({ p: pos, phase, s });
      // small decaying hops after the landing
      if (hop > 0 || hopV > 0) {
        hopV -= G * dt;
        hop += hopV * dt;
        if (hop <= 0) {
          hop = 0;
          hopV = -hopV * 0.35;
          if (hopV < 6) hopV = 0;
        }
      }
      const a = ROLL * -G * c.t[2] - chuteResistance * v;
      v += a * dt;
      s += v * dt;
      if (v <= 0) return { samples, dt, T: t, vEnd: 0, minRampSpeed, ok: false };
      if (s >= CHUTE_LENGTH) return { samples, dt, T: t + dt, vEnd: v, minRampSpeed, ok: true };
    }
    t += dt;
  }
  return { samples, dt, T: t, vEnd: v, minRampSpeed, ok: false };
}
