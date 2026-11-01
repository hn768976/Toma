import { V3, add, len, lerp3, norm, rotX, rotY, rotZ, scale, sub } from "./math";

/**
 * "String art" sculpture: every ribbon is a family of N strands. Strand u
 * runs rail A(u) -> rail M(u) -> rail B(u) with a rounded corner at M, so the
 * family forms folded ruled surfaces like the reference footage.
 */

type Rail =
  | { kind: "point"; p: V3 }
  | { kind: "line"; p0: V3; p1: V3 }
  | { kind: "arc"; c: V3; a: V3; b: V3; t0: number; t1: number; wobble?: number };

type Ribbon = {
  strands: number;
  rails: [Rail, Rail, Rail];
  /** Corner rounding as fraction of the shorter leg. */
  fillet: number;
  /** Slow looping morph: rotation amplitude about the ribbon pivot. */
  pivot: V3;
  sway: { x: number; y: number; z: number; phase: number };
};

export const LOOP_FRAMES = 180; // the reference repeats every 6 s

const RIBBONS: Ribbon[] = [
  // big fan converging to an apex, folded once (reference: opening frames)
  {
    strands: 30,
    rails: [
      { kind: "point", p: [-0.35, -1.05, 0.15] },
      { kind: "arc", c: [0.0, 0.25, 0.0], a: [1.05, 0, 0], b: [0, 0.15, 0.95], t0: -2.3, t1: 0.35, wobble: 0.25 },
      { kind: "line", p0: [1.35, 0.85, -0.55], p1: [0.2, 1.25, 0.95] },
    ],
    fillet: 0.32,
    pivot: [0, 0, 0],
    sway: { x: 0.18, y: 0.35, z: 0.12, phase: 0 },
  },
  // twisted strip with a hard Z-bend (reference: the "<" shaped sheets)
  {
    strands: 28,
    rails: [
      { kind: "line", p0: [-1.35, -0.25, -0.75], p1: [-0.55, -0.75, 0.85] },
      { kind: "line", p0: [0.45, 0.55, -0.85], p1: [0.15, 0.05, 0.75] },
      { kind: "line", p0: [1.25, -0.65, 0.55], p1: [1.05, 0.35, -0.75] },
    ],
    fillet: 0.22,
    pivot: [0, 0, 0],
    sway: { x: 0.25, y: -0.3, z: 0.2, phase: 2.1 },
  },
  // helical sheet sweeping around the centre
  {
    strands: 32,
    rails: [
      { kind: "arc", c: [0, -0.35, 0], a: [1.2, 0, 0], b: [0, 0, 1.2], t0: 0.4, t1: 3.3, wobble: 0.2 },
      { kind: "arc", c: [0, 0.45, 0], a: [0.55, 0, 0], b: [0, 0.2, 0.55], t0: 1.4, t1: 4.6 },
      { kind: "point", p: [0.25, 1.35, 0.15] },
    ],
    fillet: 0.28,
    pivot: [0, 0.2, 0],
    sway: { x: -0.2, y: 0.4, z: 0.15, phase: 4.0 },
  },
  // smaller crossing fan
  {
    strands: 24,
    rails: [
      { kind: "line", p0: [-0.9, 0.9, 0.6], p1: [-1.2, 0.2, -0.6] },
      { kind: "point", p: [-0.15, 0.1, -0.15] },
      { kind: "arc", c: [-0.2, -0.8, -0.2], a: [0.75, 0, 0], b: [0, 0.25, 0.75], t0: 3.4, t1: 5.9, wobble: 0.3 },
    ],
    fillet: 0.4,
    pivot: [-0.3, 0, 0],
    sway: { x: 0.3, y: 0.25, z: -0.2, phase: 1.0 },
  },
];

const railAt = (r: Rail, u: number, tau: number): V3 => {
  if (r.kind === "point") return r.p;
  if (r.kind === "line") return lerp3(r.p0, r.p1, u);
  const t = r.t0 + (r.t1 - r.t0) * u + (r.wobble ?? 0) * Math.sin(tau + u * 2.0);
  return add(r.c, add(scale(r.a, Math.cos(t)), scale(r.b, Math.sin(t))));
};

const transform = (p: V3, rb: Ribbon, tau: number): V3 => {
  const ph = tau + rb.sway.phase;
  let q = sub(p, rb.pivot);
  q = rotX(q, rb.sway.x * Math.sin(ph));
  q = rotY(q, rb.sway.y * Math.sin(ph + 1.3));
  q = rotZ(q, rb.sway.z * Math.cos(ph));
  return add(q, rb.pivot);
};

const STRAIGHT_STEPS = 14;
const CORNER_STEPS = 10;

/** World-space polylines of every strand for the given frame. */
export const buildStrands = (frame: number): V3[][] => {
  const tau = (2 * Math.PI * frame) / LOOP_FRAMES;
  const out: V3[][] = [];
  for (const rb of RIBBONS) {
    for (let i = 0; i < rb.strands; i++) {
      const u = rb.strands === 1 ? 0.5 : i / (rb.strands - 1);
      const A = transform(railAt(rb.rails[0], u, tau), rb, tau);
      const M = transform(railAt(rb.rails[1], u, tau), rb, tau);
      const B = transform(railAt(rb.rails[2], u, tau), rb, tau);
      const la = len(sub(A, M));
      const lb = len(sub(B, M));
      const r = rb.fillet * Math.min(la, lb);
      const P1 = add(M, scale(norm(sub(A, M)), r));
      const P2 = add(M, scale(norm(sub(B, M)), r));
      const pts: V3[] = [];
      for (let k = 0; k < STRAIGHT_STEPS; k++) pts.push(lerp3(A, P1, k / STRAIGHT_STEPS));
      for (let k = 0; k < CORNER_STEPS; k++) {
        const t = k / CORNER_STEPS;
        // quadratic Bézier P1 -> M -> P2
        pts.push(add(add(scale(P1, (1 - t) * (1 - t)), scale(M, 2 * t * (1 - t))), scale(P2, t * t)));
      }
      for (let k = 0; k <= STRAIGHT_STEPS; k++) pts.push(lerp3(P2, B, k / STRAIGHT_STEPS));
      out.push(pts);
    }
  }
  return out;
};
