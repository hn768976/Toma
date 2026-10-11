// Field-line tracing by RK4 integration of the unit field direction, so the
// parameter is arc length. Fields are evaluated from their physical formulas
// (Coulomb / magnetic dipole / magnetic charges); nothing is drawn by hand.

export type V3 = [number, number, number];
export type Field = (p: V3) => V3;

const add = (a: V3, b: V3, s: number): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const norm = (v: V3) => Math.hypot(v[0], v[1], v[2]);

export interface TraceOptions {
  /** +1 along the field, -1 against it */
  dir: 1 | -1;
  /** step length at p */
  step: (p: V3) => number;
  /** return true to stop (the point that triggered the stop is kept) */
  stop: (p: V3) => boolean;
  maxSteps?: number;
  /** stop when |F| falls below this (neutral point) */
  minField?: number;
}

export const traceLine = (field: Field, start: V3, o: TraceOptions): V3[] => {
  const pts: V3[] = [start];
  let p = start;
  const unit = (q: V3): V3 | null => {
    const f = field(q);
    const m = norm(f);
    if (m < (o.minField ?? 1e-9)) return null;
    return [(f[0] / m) * o.dir, (f[1] / m) * o.dir, (f[2] / m) * o.dir];
  };
  const max = o.maxSteps ?? 4000;
  for (let i = 0; i < max; i++) {
    const h = o.step(p);
    const k1 = unit(p);
    if (!k1) break;
    const k2 = unit(add(p, k1, h / 2));
    if (!k2) break;
    const k3 = unit(add(p, k2, h / 2));
    if (!k3) break;
    const k4 = unit(add(p, k3, h));
    if (!k4) break;
    p = [
      p[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      p[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
      p[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    ];
    pts.push(p);
    if (o.stop(p)) break;
  }
  return pts;
};

/** Point charges (electric, or magnetic "charges" at pole faces): F = sum q r / |r|^3 */
export const chargeField = (charges: { p: V3; q: number }[]): Field => (x) => {
  let fx = 0, fy = 0, fz = 0;
  for (const c of charges) {
    const dx = x[0] - c.p[0], dy = x[1] - c.p[1], dz = x[2] - c.p[2];
    const r2 = dx * dx + dy * dy + dz * dz + 1e-12;
    const inv = c.q / (r2 * Math.sqrt(r2));
    fx += dx * inv; fy += dy * inv; fz += dz * inv;
  }
  return [fx, fy, fz];
};

/** Ideal magnetic dipole m at the origin: B = (3 (m.r^) r^ - m) / r^3 */
export const dipoleField = (m: V3): Field => (x) => {
  const r = norm(x) + 1e-12;
  const rh: V3 = [x[0] / r, x[1] / r, x[2] / r];
  const md = m[0] * rh[0] + m[1] * rh[1] + m[2] * rh[2];
  const r3 = r * r * r;
  return [(3 * md * rh[0] - m[0]) / r3, (3 * md * rh[1] - m[1]) / r3, (3 * md * rh[2] - m[2]) / r3];
};

/** Resample a polyline to roughly uniform spacing (keeps ribbons smooth). */
export const resample = (pts: V3[], spacing: number): V3[] => {
  if (pts.length < 2) return pts;
  const out: V3[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    let t = spacing - carry;
    while (t <= seg) {
      const u = t / seg;
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
      t += spacing;
    }
    carry = seg - (t - spacing);
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1], last[2] - tail[2]) > spacing * 0.05) out.push(last);
  return out;
};

/** Arc-length sampler for moving dots along a fixed line. */
export class PathSampler {
  readonly cum: Float64Array;
  readonly length: number;
  constructor(readonly pts: V3[]) {
    this.cum = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      this.cum[i] = this.cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    this.length = this.cum[pts.length - 1];
  }
  /** position at arc length s */
  at(s: number, out: V3 = [0, 0, 0]): V3 {
    const c = this.cum;
    const n = c.length;
    if (s <= 0) { const p = this.pts[0]; out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; return out; }
    if (s >= this.length) { const p = this.pts[n - 1]; out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; return out; }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= s) lo = mid; else hi = mid; }
    const u = (s - c[lo]) / Math.max(c[hi] - c[lo], 1e-12);
    const a = this.pts[lo], b = this.pts[hi];
    out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = a[2] + (b[2] - a[2]) * u;
    return out;
  }
}

export const flat = (pts: V3[]) => {
  const f = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => { f[i * 3] = p[0]; f[i * 3 + 1] = p[1]; f[i * 3 + 2] = p[2]; });
  return f;
};

/** Resample with fine spacing inside `inside(p)` and coarse spacing elsewhere. */
export const resampleAdaptive = (pts: V3[], fine: number, coarse: number, inside: (p: V3) => boolean): V3[] => {
  const dense = resample(pts, fine);
  const out: V3[] = [];
  let acc = coarse;
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i];
    const keep = i === 0 || i === dense.length - 1 || inside(p) || (i > 0 && inside(dense[i - 1])) ||
      (i < dense.length - 1 && inside(dense[i + 1]));
    if (keep) { out.push(p); acc = 0; continue; }
    acc += fine;
    if (acc >= coarse) { out.push(p); acc = 0; }
  }
  return out;
};

/**
 * Small circular current loop of radius a in the xz-plane (a physical magnetic
 * dipole, moment along +y). Biot-Savart summed over n straight segments.
 */
export const currentLoopField = (a: number, n = 96): Field => {
  const mids: V3[] = [], dls: V3[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = (TAU_ * i) / n, t1 = (TAU_ * (i + 1)) / n;
    // traversed clockwise seen from +y, so B points +y through the loop
    const p0: V3 = [a * Math.cos(t0), 0, -a * Math.sin(t0)];
    const p1: V3 = [a * Math.cos(t1), 0, -a * Math.sin(t1)];
    mids.push([(p0[0] + p1[0]) / 2, 0, (p0[2] + p1[2]) / 2]);
    dls.push([p1[0] - p0[0], 0, p1[2] - p0[2]]);
  }
  return (p) => {
    let bx = 0, by = 0, bz = 0;
    for (let i = 0; i < n; i++) {
      const m = mids[i], d = dls[i];
      const rx = p[0] - m[0], ry = p[1] - m[1], rz = p[2] - m[2];
      const r2 = rx * rx + ry * ry + rz * rz + 1e-12;
      const inv = 1 / (r2 * Math.sqrt(r2));
      bx += (d[1] * rz - d[2] * ry) * inv;
      by += (d[2] * rx - d[0] * rz) * inv;
      bz += (d[0] * ry - d[1] * rx) * inv;
    }
    return [bx, by, bz];
  };
};
const TAU_ = Math.PI * 2;
