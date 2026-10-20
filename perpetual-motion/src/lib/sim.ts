// Moving weights that ride a turning wheel (hinged hammers, balls in channels)
// are simulated once, at module load, as real damped systems driven by the
// wheel: gravity, the hinge or channel geometry, end stops with restitution.
// Because the wheel turns steadily, the motion settles into a cycle that
// repeats every revolution. We integrate until it does and keep the last
// revolution as a table: the part's pose is then a pure function of the wheel
// angle, so every frame is deterministic and the loop closes exactly.

export const DEG = Math.PI / 180;
const G = 9.81;

/** mulberry32: a seeded PRNG, used only at module level for fixed variety. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PeriodicTable {
  /** value at wheel position a (degrees, any range), linear between samples */
  at: (a: number) => number;
  /** largest change between the last two simulated revolutions */
  residual: number;
  samples: Float64Array;
}

const SAMPLES = 3600;
const SUBSTEPS = 40;

function tableOf(samples: Float64Array, residual: number): PeriodicTable {
  return {
    residual,
    samples,
    at: (a: number) => {
      const x = ((((a % 360) + 360) % 360) / 360) * SAMPLES;
      const i = Math.floor(x) % SAMPLES;
      const j = (i + 1) % SAMPLES;
      const t = x - Math.floor(x);
      return samples[i] * (1 - t) + samples[j] * t;
    },
  };
}

/**
 * A hinged hammer on a wheel rim. Flat coordinates with y down (gravity at
 * +90°). The wheel turns by +Ω (clockwise as seen). The hinge sits at radius
 * R and wheel position `a`; the arm's absolute angle ψ, relative angle
 * φ = ψ − a, is held between a peg (`folded`, trailing) and a stop (`out`).
 * Returns φ (degrees) as a function of the hinge position a (degrees).
 */
export function hammerTable(o: { R: number; arm: number; folded: number; out: number; period: number; damping: number; restitution: number }): PeriodicTable {
  const omega = (2 * Math.PI) / o.period;
  const lo = o.folded * DEG;
  const hi = o.out * DEG;
  const stepsPerRev = SAMPLES * SUBSTEPS;
  const dt = o.period / stepsPerRev;
  let a = -90 * DEG;
  let phi = lo;
  let dphi = 0;
  const revs = 6;
  const last = new Float64Array(SAMPLES);
  const prev = new Float64Array(SAMPLES);
  // start the sampling at a = 0 so sample k is position k·0.1°
  a = 0;
  for (let rev = 0; rev < revs; rev++) {
    for (let k = 0; k < SAMPLES; k++) {
      if (rev === revs - 2) prev[k] = phi;
      if (rev === revs - 1) last[k] = phi;
      for (let s = 0; s < SUBSTEPS; s++) {
        const psi = a + phi;
        // gravity torque, the hinge's centripetal pseudo-force, hinge friction
        const accel = (G / o.arm) * Math.cos(psi) + ((omega * omega * o.R) / o.arm) * Math.sin(a - psi) - o.damping * dphi;
        dphi += accel * dt;
        phi += dphi * dt;
        a += omega * dt;
        if (phi < lo) {
          phi = lo;
          if (dphi < 0) dphi = -dphi * o.restitution;
        } else if (phi > hi) {
          phi = hi;
          if (dphi > 0) dphi = -dphi * o.restitution;
        }
      }
    }
  }
  let residual = 0;
  for (let k = 0; k < SAMPLES; k++) residual = Math.max(residual, Math.abs(last[k] - prev[k]));
  const deg = new Float64Array(SAMPLES);
  for (let k = 0; k < SAMPLES; k++) deg[k] = last[k] / DEG;
  return tableOf(deg, residual / DEG);
}

/** A planar curve sampled by arc length (flat coordinates of the wheel). */
export interface Channel {
  length: number;
  point: (s: number) => [number, number];
  tangent: (s: number) => [number, number];
}

export function channelOf(points: [number, number][]): Channel {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const length = lengths[lengths.length - 1];
  const locate = (s: number) => {
    const t = Math.min(length, Math.max(0, s));
    let lo = 0;
    let hi = lengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] <= t) lo = mid;
      else hi = mid;
    }
    const span = lengths[hi] - lengths[lo] || 1;
    return { i: lo, j: hi, f: (t - lengths[lo]) / span };
  };
  return {
    length,
    point: (s) => {
      const { i, j, f } = locate(s);
      return [points[i][0] + (points[j][0] - points[i][0]) * f, points[i][1] + (points[j][1] - points[i][1]) * f];
    },
    tangent: (s) => {
      const { i, j } = locate(s);
      const dx = points[j][0] - points[i][0];
      const dy = points[j][1] - points[i][1];
      const n = Math.hypot(dx, dy) || 1;
      return [dx / n, dy / n];
    },
  };
}

/**
 * A ball rolling in a channel fixed to a wheel turning by +Ω. Flat units are
 * centimetres, the channel runs from s = 0 (hub end) to s = length (rim end).
 * Rolling without slipping (5/7 of g along the slope), rolling resistance,
 * end stops with a small bounce. Returns s as a function of the wheel angle θ
 * (degrees) for a channel whose wheel angle offset is 0.
 */
export function ballTable(o: { channel: Channel; ballRadius: number; period: number; damping: number; restitution: number }): PeriodicTable {
  const omega = (2 * Math.PI) / o.period;
  const lo = o.ballRadius * 0.9;
  const hi = o.channel.length - o.ballRadius * 0.9;
  const stepsPerRev = SAMPLES * SUBSTEPS;
  const dt = o.period / stepsPerRev;
  let theta = 0;
  let s = lo;
  let v = 0;
  const revs = 6;
  const last = new Float64Array(SAMPLES);
  const prev = new Float64Array(SAMPLES);
  for (let rev = 0; rev < revs; rev++) {
    for (let k = 0; k < SAMPLES; k++) {
      if (rev === revs - 2) prev[k] = s;
      if (rev === revs - 1) last[k] = s;
      for (let n = 0; n < SUBSTEPS; n++) {
        const c = Math.cos(theta);
        const sn = Math.sin(theta);
        const [tx, ty] = o.channel.tangent(s);
        const [px, py] = o.channel.point(s);
        // tangent and position in the fixed frame (flat, y down)
        const wty = tx * sn + ty * c;
        const wpx = px * c - py * sn;
        const wpy = px * sn + py * c;
        const wtx = tx * c - ty * sn;
        const centrifugal = omega * omega * (wpx * wtx + wpy * wty);
        const accel = (5 / 7) * (G * 100 * wty + centrifugal) - o.damping * v;
        v += accel * dt;
        s += v * dt;
        theta += omega * dt;
        if (s < lo) {
          s = lo;
          if (v < 0) v = -v * o.restitution;
        } else if (s > hi) {
          s = hi;
          if (v > 0) v = -v * o.restitution;
        }
      }
    }
  }
  let residual = 0;
  for (let k = 0; k < SAMPLES; k++) residual = Math.max(residual, Math.abs(last[k] - prev[k]));
  return tableOf(last, residual);
}
