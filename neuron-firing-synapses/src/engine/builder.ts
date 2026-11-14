import { FLOATS_PER_CAPSULE } from "./renderer";

export type V3 = [number, number, number];

/** Small, fast, seedable PRNG (mulberry32) so geometry is identical in every render tab. */
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    sign: () => (next() < 0.5 ? -1 : 1),
    /** uniformly distributed unit vector */
    dir: (): V3 => {
      const z = next() * 2 - 1;
      const t = next() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      return [r * Math.cos(t), r * Math.sin(t), z];
    },
  };
};
export type Rng = ReturnType<typeof makeRng>;

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export type CapsuleStyle = {
  col: V3;
  /** 1 = solid, 0 = purely additive */
  opacity: number;
  mat: number;
  fire?: number;
  glow?: number;
  extra?: number;
  /**
   * Draw-order bias in world units: the capsule is sorted as if it were this much closer to the
   * camera. Used where parts interpenetrate (sheath over axon core, soma over branch roots) so
   * their paint order can never flip from one frame to the next.
   */
  bias?: number;
};

export class Builder {
  data: number[] = [];
  count = 0;
  /** transform applied to everything that is pushed (used to place whole neurons) */
  offset: V3 = [0, 0, 0];
  scale = 1;
  rot = 0; // rotation around Y
  rotX = 0;
  /** colour multiplier and opacity multiplier for everything pushed */
  tint = 1;
  fade = 1;

  private tx(p: V3): V3 {
    const c = Math.cos(this.rot);
    const s = Math.sin(this.rot);
    let x = p[0] * c + p[2] * s;
    let y = p[1];
    let z = -p[0] * s + p[2] * c;
    const cx = Math.cos(this.rotX);
    const sx = Math.sin(this.rotX);
    const y2 = y * cx - z * sx;
    z = y * sx + z * cx;
    y = y2;
    x *= this.scale;
    return [x + this.offset[0], y * this.scale + this.offset[1], z * this.scale + this.offset[2]];
  }

  capsule(a: V3, ra: number, b: V3, rb: number, st: CapsuleStyle, seed: number, s0 = 0, s1 = 0) {
    const A = this.tx(a);
    const B = this.tx(b);
    this.data.push(
      A[0], A[1], A[2], ra * this.scale,
      B[0], B[1], B[2], rb * this.scale,
      st.col[0] * this.tint, st.col[1] * this.tint, st.col[2] * this.tint, st.opacity * this.fade,
      st.mat, seed, s0, s1,
      st.fire ?? 0, st.glow ?? 0, st.extra ?? 0, st.bias ?? 0,
    );
    this.count++;
  }

  point(p: V3, r: number, st: CapsuleStyle, seed: number, s = 0) {
    this.capsule(p, r, p, r, st, seed, s, s);
  }

  toArray() {
    if (this.data.length !== this.count * FLOATS_PER_CAPSULE) throw new Error("capsule layout");
    return new Float32Array(this.data);
  }
}

export type BranchOpts = {
  /** style as a function of radius / path distance / depth */
  style: (r: number, s: number, depth: number, rng: Rng) => CapsuleStyle;
  /** signed path distance direction: +1 grows away with positive s, -1 with negative s */
  sSign: number;
  wobble: number;
  /** wander strength of thick fibres (thin ones always curl freely) */
  thickWobble?: number;
  /** wander strength of thin fibres: ~4 = curly hair, ~1 = straight twigs (default 4) */
  thinWobble?: number;
  /** how much a side twig follows its parent's direction: 0.35 = sticks out, 1+ = feathered (default 0.35) */
  twigForward?: number;
  /** shortest capsule length; straight twigs can use longer pieces (default 0.07) */
  minStep?: number;
  /** most capsules one side twig (with its own sub-twigs) may use (default 45) */
  twigBudget?: number;
  /** squash factor for the depth (z) component of growth directions: <1 keeps the tree nearer one plane */
  flatten?: number;
  /** side twigs per unit length */
  twigRate: number;
  twigLen: [number, number];
  twigR: number;
  minR: number;
  maxDepth: number;
  spread: number;
  childScale: number;
  lenScale: number;
  bias?: V3; // constant directional pull
  biasK?: number;
  /** called at every finished tip (used to place synapse particles / boutons) */
  onTip?: (p: V3, s: number, depth: number) => void;
  /** called along the branch for decorations such as spines */
  onStep?: (p: V3, d: V3, r: number, s: number, depth: number) => void;
  budget: { left: number };
};

/** Recursive wandering, tapering, forking branch. */
export const growBranch = (
  b: Builder,
  rng: Rng,
  p0: V3,
  d0: V3,
  r0: number,
  length: number,
  depth: number,
  s0: number,
  o: BranchOpts,
) => {
  if (o.budget.left <= 0) return;
  let p = p0;
  let d = norm(d0);
  const step = Math.min(0.24, Math.max(o.minStep ?? 0.07, r0 * 2.2));
  const n = Math.max(2, Math.ceil(length / step));
  const rEnd = Math.max(o.minR * 0.7, r0 * 0.62);
  let s = s0;
  const seed = rng.next();
  let wob = rng.dir();
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    // smoothly varying wander direction
    wob = norm(add(mul(wob, 0.75), mul(rng.dir(), 0.5)));
    let nd = add(d, mul(wob, o.wobble * step * (r0 > 0.03 ? (o.thickWobble ?? 1.8) : (o.thinWobble ?? 4))));
    if (o.bias) nd = add(nd, mul(o.bias, (o.biasK ?? 0.1) * step));
    if (o.flatten !== undefined) nd = [nd[0], nd[1], nd[2] * lerp(1, o.flatten, Math.min(1, step * 2))];
    d = norm(nd);
    const p1 = add(p, mul(d, step));
    const ra = lerp(r0, rEnd, t0);
    const rb = lerp(r0, rEnd, t1);
    const s1 = s + o.sSign * step;
    b.capsule(p, ra, p1, rb, o.style(ra, s, depth, rng), seed, s, s1);
    o.budget.left--;
    if (o.onStep) o.onStep(p1, d, rb, s1, depth);
    if (rng.next() < o.twigRate * step && depth < o.maxDepth) {
      const side = norm(add(mul(d, o.twigForward ?? 0.35), rng.dir()));
      const tr = Math.min(rb * 0.5, o.twigR * rng.range(0.7, 1.4));
      if (tr >= o.minR * 0.6) {
        // a twig gets a small budget of its own, so early twigs cannot starve the rest of the tree
        const sub = { left: Math.min(o.budget.left, o.twigBudget ?? 45) };
        const before = sub.left;
        growBranch(b, rng, p1, side, tr, rng.range(o.twigLen[0], o.twigLen[1]), depth + 1, s1, { ...o, budget: sub });
        o.budget.left -= before - sub.left;
      }
    }
    p = p1;
    s = s1;
    if (o.budget.left <= 0) return;
  }
  const cr = rEnd * o.childScale;
  if (depth < o.maxDepth && cr >= o.minR) {
    const kids = rng.next() < 0.25 ? 3 : 2;
    // the remaining budget is shared out evenly between the child branches
    const share = Math.floor(o.budget.left / kids);
    for (let k = 0; k < kids; k++) {
      const cd = norm(add(d, mul(rng.dir(), o.spread)));
      const sub = { left: share };
      growBranch(b, rng, p, cd, cr * rng.range(0.85, 1.1), length * o.lenScale * rng.range(0.75, 1.2), depth + 1, s, { ...o, budget: sub });
      o.budget.left -= share - sub.left;
    }
  } else if (o.onTip) {
    o.onTip(p, s, depth);
  }
};
