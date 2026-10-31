// Almond eye geometry shared by every eye look. Lid curves are sampled at N
// points from the inner to the outer corner, in eye-local units (eye centre
// at 0,0, width w). A blink closes both lids onto a curve that sits 72% of
// the way down, so the upper lid travels most, as in a real blink.
import { evalWobble, lerp, TAU, type Pt, type Wobble } from "./math";
import type { Rng } from "./rng";

export type AlmondSpec = {
  w: number;
  h: number;
  upperPow: number; // < 1 rounder, ~1 pointed corners
  lowerPow: number;
  upperSkew: number; // -1..1 moves the highest point towards a corner
  lowerSkew: number;
  closeAt?: number; // where the lids meet (0 = upper, 1 = lower)
  upperFrac?: number; // share of the height above the corner line (default 0.5)
};

export type AlmondJitter = {
  up: Wobble;
  lo: Wobble;
  cornerL: Pt;
  cornerR: Pt;
};

export const makeJitter = (rng: Rng, amp: number): AlmondJitter => {
  const wob = (): Wobble =>
    [1, 2, 3].map((freq) => ({
      amp: (amp / freq) * rng.range(0.4, 1),
      freq: freq / 2,
      phase: rng.range(0, TAU),
    }));
  return {
    up: wob(),
    lo: wob(),
    cornerL: [rng.gauss() * amp * 0.6, rng.gauss() * amp * 0.6],
    cornerR: [rng.gauss() * amp * 0.6, rng.gauss() * amp * 0.6],
  };
};

export const N_LID = 40;

export type Lids = { upper: Pt[]; lower: Pt[]; closed: Pt[] };

export const lids = (s: AlmondSpec, j: AlmondJitter | null, open: number): Lids => {
  const upper: Pt[] = [];
  const lower: Pt[] = [];
  const closed: Pt[] = [];
  const closeAt = s.closeAt ?? 0.72;
  for (let i = 0; i < N_LID; i++) {
    const t = i / (N_LID - 1);
    const u = t * 2 - 1;
    const env = 1 - u * u;
    const uf = s.upperFrac ?? 0.5;
    const uy = -s.h * uf * Math.pow(env, s.upperPow) * (1 + s.upperSkew * u * 0.35);
    const ly = s.h * (1 - uf) * Math.pow(env, s.lowerPow) * (1 + s.lowerSkew * u * 0.35);
    // Corner jitter fades in from the corner; lid wobble vanishes at corners.
    const cx = j ? lerp(j.cornerL[0], j.cornerR[0], t) : 0;
    const cy = j ? lerp(j.cornerL[1], j.cornerR[1], t) : 0;
    const wu = j ? evalWobble(j.up, t) * Math.sqrt(env) : 0;
    const wl = j ? evalWobble(j.lo, t) * Math.sqrt(env) : 0;
    const x = u * (s.w / 2) + cx;
    const yU = uy + cy + wu;
    const yL = ly + cy + wl;
    const yC = lerp(yU, yL, closeAt);
    upper.push([x, yC + (yU - yC) * open]);
    lower.push([x, yC + (yL - yC) * open]);
    closed.push([x, yC]);
  }
  return { upper, lower, closed };
};

export const lidPath = (l: Lids) => {
  const p = new Path2D();
  l.upper.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  for (let i = l.lower.length - 1; i >= 0; i--) p.lineTo(l.lower[i][0], l.lower[i][1]);
  p.closePath();
  return p;
};

// Lid outline as a polygon (upper left->right, lower right->left).
export const lidPolygon = (l: Lids): Pt[] => [...l.upper, ...[...l.lower].reverse()];

// Frays lid curves with small per-variant wobbles: the edge of a shape cut
// or painted by hand. Zero at the corners.
export const frayLids = (l: Lids, j: AlmondJitter, amp: number): Lids => {
  const fray = (pts: Pt[], k: number) =>
    pts.map(([x, y], i): Pt => {
      const env = Math.sin((Math.PI * i) / (pts.length - 1));
      const n = Math.sin(i * 2.7 + j.up[0].phase * 7 + k) + 0.6 * Math.sin(i * 5.3 + j.lo[1].phase * 5 + k);
      return [x, y + env * amp * n];
    });
  return { upper: fray(l.upper, 0), lower: fray(l.lower, 3), closed: l.closed };
};
