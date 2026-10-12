// Procedural, tileable city. One seeded generator drives all three city looks.
//
// The map is a torus: W x W metres that repeats seamlessly at its edges, so the
// camera can pan forever. Geometry is stored "unwrapped" (a polyline may run
// past the tile edge) and drawn with wrap-around copies.

import { periodicFbm, periodicNoise } from "../lib/noise";
import { chance, irange, mulberry32, pick, range, Rng } from "../lib/random";

export type V2 = { x: number; y: number };
export type RoadClass = 0 | 1 | 2; // local, avenue, arterial

export type DistrictKind = "downtown" | "grid" | "suburb" | "organic" | "industrial" | "mixed";

export interface District {
  kind: DistrictKind;
  seed: V2;
  angle: number;
  U: V2; // grid axis along which family-A lines are spaced
  V: V2;
  a: number; // spacing of family A (lines of constant u)
  b: number; // spacing of family B (lines of constant v)
  offA: number;
  offB: number;
  poly: V2[]; // convex Voronoi cell, unwrapped around `seed`
  warp: boolean;
  avenueEveryA: number;
  avenueEveryB: number;
  dropLocal: number;
}

export interface Edge {
  pts: V2[];
  cls: RoadClass;
  n0: number;
  n1: number;
  len: number;
}

export interface Building {
  pts: V2[];
  shade: number;
}

export interface Route {
  pts: V2[]; // closed polyline (last point == first point)
  cum: number[]; // cumulative length at each point
  length: number;
}

export interface City {
  W: number;
  seed: number;
  districts: District[];
  nodes: V2[];
  edges: Edge[];
  water: V2[][]; // polygons
  parks: V2[][];
  lots: V2[][];
  rails: V2[][]; // polylines inside rail yards
  buildings: Building[];
  labels: { p: V2; angle: number; n: number }[]; // little "text" dash groups
  route: Route;
  inWater: (p: V2) => boolean;
}

// ---------------------------------------------------------------------------
// small vector helpers
const v = (x: number, y: number): V2 => ({ x, y });
const add = (a: V2, b: V2) => v(a.x + b.x, a.y + b.y);
const sub = (a: V2, b: V2) => v(a.x - b.x, a.y - b.y);
const mul = (a: V2, s: number) => v(a.x * s, a.y * s);
const dot = (a: V2, b: V2) => a.x * b.x + a.y * b.y;
const len = (a: V2) => Math.hypot(a.x, a.y);
const lerpV = (a: V2, b: V2, t: number) => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const mod = (a: number, n: number) => ((a % n) + n) % n;

// ---------------------------------------------------------------------------
// convex polygon utilities

interface LabeledVertex {
  p: V2;
  label: number; // label of the edge starting at this vertex
}

// Keep the part of the polygon where n·p <= c.
const clipHalfPlane = (poly: LabeledVertex[], n: V2, c: number, label: number) => {
  const out: LabeledVertex[] = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % poly.length];
    const dp = dot(n, P.p) - c;
    const dq = dot(n, Q.p) - c;
    const pin = dp <= 0;
    const qin = dq <= 0;
    if (pin) out.push(P);
    if (pin !== qin) {
      const t = dp / (dp - dq);
      const I = lerpV(P.p, Q.p, t);
      out.push({ p: I, label: pin ? label : P.label });
    }
  }
  return out;
};

const polyArea = (poly: V2[]) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
};

export const pointInPoly = (p: V2, poly: V2[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
};

// Cyrus-Beck: parameter range [t0,t1] of A + t*D inside the convex polygon.
const clipLineConvex = (A: V2, D: V2, poly: V2[], ccw: boolean): [number, number] | null => {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const e0 = poly[i];
    const e1 = poly[(i + 1) % poly.length];
    const ed = sub(e1, e0);
    // outward normal
    const n = ccw ? v(ed.y, -ed.x) : v(-ed.y, ed.x);
    const num = dot(n, sub(A, e0));
    const den = dot(n, D);
    if (Math.abs(den) < 1e-12) {
      if (num > 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t1 = Math.min(t1, t);
    else t0 = Math.max(t0, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
};

// ---------------------------------------------------------------------------

export interface CityParams {
  seed: number;
  W?: number;
}

// Block spacings are scaled so the 3 km tile carries a dense, fine street
// mesh (as in the references) without zooming out until the tile repeats.
const BLOCK_SCALE = 0.36;

export const generateCity = ({ seed, W = 3000 }: CityParams): City => {
  const rng = mulberry32(seed);
  const torusDelta = (a: number, b: number) => {
    let d = b - a;
    d -= Math.round(d / W) * W;
    return d;
  };
  const torusDist = (a: V2, b: V2) => Math.hypot(torusDelta(a.x, b.x), torusDelta(a.y, b.y));

  // ---- water: a sea band across one edge, and a river crossing the tile ----
  const seaY = range(rng, 0, W);
  const seaPhase = [range(rng, 0, 6.28), range(rng, 0, 6.28), range(rng, 0, 6.28), range(rng, 0, 6.28)];
  const seaNoise = periodicFbm(rng, 6, 3);
  const seaTop = (x: number) =>
    seaY - 150 + 70 * Math.sin((6.2832 * x) / W + seaPhase[0]) + 45 * Math.sin((6.2832 * 3 * x) / W + seaPhase[1]) + 40 * seaNoise((x / W) * 6, 0.5);
  const seaBot = (x: number) =>
    seaY + 160 + 60 * Math.sin((6.2832 * 2 * x) / W + seaPhase[2]) + 30 * Math.sin((6.2832 * 5 * x) / W + seaPhase[3]) + 40 * seaNoise((x / W) * 6, 3.5);
  const riverX0 = range(rng, 0, W);
  const rp = [range(rng, 0, 6.28), range(rng, 0, 6.28), range(rng, 0, 6.28), range(rng, 0, 6.28)];
  const riverX = (y: number) =>
    riverX0 + 260 * Math.sin((6.2832 * y) / W + rp[0]) + 110 * Math.sin((6.2832 * 2 * y) / W + rp[1]) + 45 * Math.sin((6.2832 * 5 * y) / W + rp[2]);
  const riverHalfW = (y: number) => 0.5 * (92 + 12 * Math.sin((6.2832 * 3 * y) / W + rp[3]));

  const inSea = (p: V2) => {
    const x = mod(p.x, W);
    const dy = torusDelta(seaY, p.y) + seaY; // y unwrapped near the sea band
    return dy > seaTop(x) && dy < seaBot(x);
  };
  const inRiver = (p: V2) => {
    const y = mod(p.y, W);
    return Math.abs(torusDelta(riverX(y), p.x)) < riverHalfW(y);
  };
  const inWater = (p: V2) => inSea(p) || inRiver(p);

  const water: V2[][] = [];
  {
    const top: V2[] = [];
    const bot: V2[] = [];
    for (let x = -40; x <= W + 40; x += 10) {
      top.push(v(x, seaTop(mod(x, W))));
      bot.push(v(x, seaBot(mod(x, W))));
    }
    water.push([...top, ...bot.reverse()]);
    const left: V2[] = [];
    const right: V2[] = [];
    for (let y = -40; y <= W + 40; y += 10) {
      const yy = mod(y, W);
      left.push(v(riverX(yy) - riverHalfW(yy), y));
      right.push(v(riverX(yy) + riverHalfW(yy), y));
    }
    water.push([...left, ...right.reverse()]);
  }

  // ---- districts: seeded Voronoi on the torus ----
  const kinds: DistrictKind[] = ["downtown", "grid", "organic", "suburb", "industrial", "mixed"];
  const seeds: V2[] = [];
  let guard = 0;
  while (seeds.length < kinds.length && guard++ < 10000) {
    const p = v(range(rng, 0, W), range(rng, 0, W));
    if (inWater(p)) continue;
    if (seeds.every((s) => torusDist(s, p) > W * 0.3)) seeds.push(p);
  }
  if (seeds.length < kinds.length) throw new Error("could not place district seeds");

  const districts: District[] = [];
  const boundaryRoads: V2[][] = [];
  const baseAngle = range(rng, 0, Math.PI / 2);
  seeds.forEach((s, i) => {
    let poly: LabeledVertex[] = [
      { p: v(s.x - W, s.y - W), label: -1 },
      { p: v(s.x + W, s.y - W), label: -1 },
      { p: v(s.x + W, s.y + W), label: -1 },
      { p: v(s.x - W, s.y + W), label: -1 },
    ];
    seeds.forEach((t, j) => {
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          if (i === j && ox === 0 && oy === 0) continue;
          const tt = v(t.x + ox * W, t.y + oy * W);
          const n = sub(tt, s);
          const c = (dot(tt, tt) - dot(s, s)) / 2;
          poly = clipHalfPlane(poly, n, c, j * 9 + (ox + 1) * 3 + (oy + 1));
        }
      }
    });
    // boundary avenues: keep each shared edge once
    for (let k = 0; k < poly.length; k++) {
      const lab = poly[k].label;
      const j = Math.floor(lab / 9);
      const ox = Math.floor((lab % 9) / 3) - 1;
      const oy = (lab % 3) - 1;
      const keep = j > i || (j === i && (ox > 0 || (ox === 0 && oy > 0)));
      if (keep) boundaryRoads.push([poly[k].p, poly[(k + 1) % poly.length].p]);
    }

    const kind = kinds[i];
    const angle = (baseAngle + (i * 0.37 + range(rng, -0.12, 0.12)) * (Math.PI / 2)) % (Math.PI / 2);
    const U = v(Math.cos(angle), Math.sin(angle));
    const V = v(-Math.sin(angle), Math.cos(angle));
    const spec: Record<DistrictKind, [number, number, number, number, number]> = {
      // a range lo/hi, b lo/hi, local street drop probability
      downtown: [24, 28, 26, 34, 0.03],
      grid: [26, 30, 58, 72, 0.05],
      organic: [36, 42, 36, 42, 0.07],
      suburb: [28, 32, 86, 104, 0.1],
      industrial: [48, 56, 90, 110, 0.12],
      mixed: [30, 34, 40, 52, 0.06],
    };
    const [alo, ahi, blo, bhi, drop] = spec[kind];
    districts.push({
      kind,
      seed: s,
      angle,
      U,
      V,
      a: range(rng, alo, ahi) * BLOCK_SCALE,
      b: range(rng, blo, bhi) * BLOCK_SCALE,
      offA: range(rng, 0, 50),
      offB: range(rng, 0, 50),
      poly: poly.map((q) => q.p),
      warp: kind === "organic",
      avenueEveryA: irange(rng, 16, 22),
      avenueEveryB: kind === "downtown" ? irange(rng, 12, 16) : kind === "suburb" || kind === "industrial" ? irange(rng, 6, 9) : irange(rng, 9, 12),
      dropLocal: drop,
    });
  });

  const warpN1 = periodicNoise(rng, 12);
  const warpN2 = periodicNoise(rng, 12);
  const warpN3 = periodicNoise(rng, 30);
  const warpN4 = periodicNoise(rng, 30);
  const warp = (p: V2): V2 => {
    const x = (p.x / W) * 12;
    const y = (p.y / W) * 12;
    const x2 = (p.x / W) * 30;
    const y2 = (p.y / W) * 30;
    return v(p.x + 40 * warpN1(x, y) + 8 * warpN3(x2, y2), p.y + 40 * warpN2(x, y) + 8 * warpN4(x2, y2));
  };

  // ---- parks and lots (block-aligned) ----
  const parks: V2[][] = [];
  const lots: V2[][] = [];
  const rails: V2[][] = [];
  const blockQuad = (d: District, i0: number, j0: number, ni: number, nj: number, inset: number) => {
    const u0 = d.offA + i0 * d.a + inset;
    const u1 = d.offA + (i0 + ni) * d.a - inset;
    const v0 = d.offB + j0 * d.b + inset;
    const v1 = d.offB + (j0 + nj) * d.b - inset;
    const P = (uu: number, vv: number) => add(mul(d.U, uu), mul(d.V, vv));
    return [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
  };
  const quadCenter = (q: V2[]) => mul(q.reduce((acc, p) => add(acc, p), v(0, 0)), 1 / q.length);
  const inPoly = (q: V2[], poly: V2[]) => q.every((p) => pointInPoly(p, poly));
  const parkBlocks = new Set<string>();

  districts.forEach((d, di) => {
    if (d.warp) {
      // organic district: a few irregular "parks" (blobs) instead of blocks
      for (let k = 0; k < 3; k++) {
        const c = add(d.seed, v(range(rng, -250, 250), range(rng, -250, 250)));
        if (!pointInPoly(c, d.poly) || inWater(c)) continue;
        const r = range(rng, 40, 85);
        const blob: V2[] = [];
        const ph = range(rng, 0, 6.28);
        for (let t = 0; t < 24; t++) {
          const a = (t / 24) * Math.PI * 2;
          const rr = r * (1 + 0.25 * Math.sin(3 * a + ph) + 0.12 * Math.sin(5 * a + 2 * ph));
          blob.push(add(c, v(Math.cos(a) * rr * 1.4, Math.sin(a) * rr)));
        }
        parks.push(blob);
      }
      return;
    }
    // projected extents of the cell
    const us = d.poly.map((p) => dot(p, d.U));
    const vs = d.poly.map((p) => dot(p, d.V));
    const i0 = Math.ceil((Math.min(...us) - d.offA) / d.a);
    const i1 = Math.floor((Math.max(...us) - d.offA) / d.a);
    const j0 = Math.ceil((Math.min(...vs) - d.offB) / d.b);
    const j1 = Math.floor((Math.max(...vs) - d.offB) / d.b);
    if (d.kind === "industrial") {
      // rail yard: long thin lot with tracks; plus a few big dark lots
      for (let tries = 0; tries < 60; tries++) {
        const ni = irange(rng, 10, 16);
        const ii = irange(rng, i0, i1 - ni);
        const jj = irange(rng, j0, j1 - 1);
        const q = blockQuad(d, ii, jj, ni, 1, 5);
        if (!inPoly(q, d.poly) || q.some(inWater)) continue;
        lots.push(q);
        for (let ii2 = ii; ii2 < ii + ni; ii2++) parkBlocks.add(`${di}:${ii2}:${jj}`);
        const tracks = Math.floor((d.b - 20) / 7);
        for (let t = 0; t < tracks; t++) {
          const vv = d.offB + jj * d.b + 10 + t * 7;
          const ua = d.offA + ii * d.a + 12 + range(rng, 0, 40);
          const ub = d.offA + (ii + ni) * d.a - 12 - range(rng, 0, 40);
          rails.push([add(mul(d.U, ua), mul(d.V, vv)), add(mul(d.U, ub), mul(d.V, vv))]);
        }
        break;
      }
      for (let k = 0, placed = 0; k < 80 && placed < 4; k++) {
        const ni = irange(rng, 2, 4);
        const nj = irange(rng, 1, 2);
        const ii = irange(rng, i0, i1 - ni);
        const jj = irange(rng, j0, j1 - nj);
        const q = blockQuad(d, ii, jj, ni, nj, 6);
        if (!inPoly(q, d.poly) || q.some(inWater)) continue;
        let clash = false;
        for (let a = ii; a < ii + ni; a++) for (let b = jj; b < jj + nj; b++) if (parkBlocks.has(`${di}:${a}:${b}`)) clash = true;
        if (clash) continue;
        for (let a = ii; a < ii + ni; a++) for (let b = jj; b < jj + nj; b++) parkBlocks.add(`${di}:${a}:${b}`);
        lots.push(q);
        placed++;
      }
    }
    // one or two large organic dark patches (big parks, cemeteries, golf)
    for (let k = 0, placed = 0; k < 30 && placed < (d.kind === "industrial" ? 1 : 2); k++) {
      const c = add(d.seed, v(range(rng, -350, 350), range(rng, -350, 350)));
      const r = range(rng, 70, 150);
      const ph = range(rng, 0, 6.28);
      // angular patch: a few straight edges, aligned loosely to the grid
      const blob: V2[] = [];
      const nv = irange(rng, 5, 7);
      for (let t = 0; t < nv; t++) {
        const a = ph + (t / nv) * Math.PI * 2 + range(rng, -0.25, 0.25);
        const rr = r * range(rng, 0.65, 1.25);
        const q = v(Math.cos(a) * rr * 1.3, Math.sin(a) * rr);
        blob.push(add(c, add(mul(d.U, dot(q, v(1, 0))), mul(d.V, dot(q, v(0, 1))))));
      }
      if (!blob.every((q) => pointInPoly(q, d.poly)) || blob.some(inWater)) continue;
      parks.push(blob);
      placed++;
    }
    // parks: ~4% of blocks, a mix of single blocks and larger merged parks
    const nBlocks = (i1 - i0 + 1) * (j1 - j0 + 1);
    const targetParkBlocks = nBlocks * (d.kind === "industrial" ? 0.015 : 0.045);
    let got = 0;
    let big = d.kind === "downtown" || d.kind === "grid" || d.kind === "mixed" ? 1 : 0;
    for (let k = 0; k < 4000 && got < targetParkBlocks; k++) {
      let ni = irange(rng, 2, 4);
      let nj = irange(rng, 1, 3);
      if (big > 0) {
        ni = Math.round(range(rng, 140, 260) / d.a);
        nj = Math.max(2, Math.round(range(rng, 140, 260) / d.b));
      }
      const ii = irange(rng, i0, i1 - ni);
      const jj = irange(rng, j0, j1 - nj);
      const q = blockQuad(d, ii, jj, ni, nj, 2.5);
      if (!inPoly(q, d.poly) || q.some(inWater) || inWater(quadCenter(q))) continue;
      let clash = false;
      for (let a = ii - 1; a <= ii + ni; a++) for (let b = jj - 1; b <= jj + nj; b++) if (parkBlocks.has(`${di}:${a}:${b}`)) clash = true;
      if (clash) continue;
      for (let a = ii; a < ii + ni; a++) for (let b = jj; b < jj + nj; b++) parkBlocks.add(`${di}:${a}:${b}`);
      if (big > 0) {
        // irregular big park: cut a corner so it doesn't read as a rectangle
        const c = quadCenter(q);
        const cut = range(rng, 0.25, 0.5);
        const corner = irange(rng, 0, 3);
        const q2: V2[] = [];
        q.forEach((p, idx) => {
          if (idx === corner) {
            const prev = q[(idx + 3) % 4];
            const next = q[(idx + 1) % 4];
            q2.push(lerpV(p, prev, cut), lerpV(p, c, cut * 0.4), lerpV(p, next, cut));
          } else q2.push(p);
        });
        parks.push(q2);
        big--;
      } else parks.push(q);
      got += ni * nj;
    }
  });

  const inParkOrLot = (p: V2) => {
    for (const poly of parks) {
      const c = poly[0];
      const pp = v(c.x + torusDelta(c.x, p.x), c.y + torusDelta(c.y, p.y));
      if (pointInPoly(pp, poly)) return true;
    }
    for (const poly of lots) {
      const c = poly[0];
      const pp = v(c.x + torusDelta(c.x, p.x), c.y + torusDelta(c.y, p.y));
      if (pointInPoly(pp, poly)) return true;
    }
    return false;
  };

  // ---- roads ----
  interface Road {
    pts: V2[];
    cls: RoadClass;
    closeOffset: V2 | null; // closed loop: last point + offset == first point
    drop: number;
  }
  const roads: Road[] = [];

  // district grids
  districts.forEach((d) => {
    const ccw = polyArea(d.poly) > 0;
    const us = d.poly.map((p) => dot(p, d.U));
    const vs = d.poly.map((p) => dot(p, d.V));
    const fam = (axisN: V2, axisT: V2, spacing: number, off: number, lo: number, hi: number, every: number) => {
      const k0 = Math.ceil((lo - off) / spacing);
      const k1 = Math.floor((hi - off) / spacing);
      const avPhase = irange(rng, 0, every - 1);
      for (let k = k0; k <= k1; k++) {
        const c = off + k * spacing;
        const A = mul(axisN, c);
        const r = clipLineConvex(A, axisT, d.poly, ccw);
        if (!r) continue;
        const ext = 1.5;
        const t0 = r[0] - ext;
        const t1 = r[1] + ext;
        if (t1 - t0 < 8) continue;
        const cls: RoadClass = mod(k, every) === avPhase ? 1 : 0;
        if (!d.warp) {
          roads.push({ pts: [add(A, mul(axisT, t0)), add(A, mul(axisT, t1))], cls, closeOffset: null, drop: d.dropLocal });
        } else {
          // organic: sample, warp, re-clip to the cell
          const pts: V2[] = [];
          const n = Math.max(2, Math.ceil((t1 - t0 + 120) / 8));
          for (let s = 0; s <= n; s++) pts.push(warp(add(A, mul(axisT, t0 - 60 + ((t1 - t0 + 120) * s) / n))));
          let cur: V2[] = [];
          for (let s = 0; s < pts.length - 1; s++) {
            const P = pts[s];
            const Q = pts[s + 1];
            const rr = clipLineConvex(P, sub(Q, P), d.poly, ccw);
            const a0 = rr ? Math.max(0, rr[0]) : 1;
            const a1 = rr ? Math.min(1, rr[1]) : 0;
            if (a1 > a0) {
              const S = lerpV(P, Q, a0);
              const E = lerpV(P, Q, a1);
              if (cur.length === 0) {
                // starting at boundary: extend backwards slightly
                const dir = sub(E, S);
                const l = len(dir) || 1;
                cur.push(a0 > 0 ? sub(S, mul(dir, ext / l)) : S);
              }
              cur.push(E);
              if (a1 < 1) {
                const dir = sub(E, S);
                const l = len(dir) || 1;
                cur[cur.length - 1] = add(E, mul(dir, ext / l));
                if (cur.length >= 2) roads.push({ pts: cur, cls, closeOffset: null, drop: d.dropLocal });
                cur = [];
              }
            } else if (cur.length) {
              if (cur.length >= 2) roads.push({ pts: cur, cls, closeOffset: null, drop: d.dropLocal });
              cur = [];
            }
          }
          if (cur.length >= 2) roads.push({ pts: cur, cls, closeOffset: null, drop: d.dropLocal });
        }
      }
    };
    fam(d.U, d.V, d.a, d.offA, Math.min(...us), Math.max(...us), d.avenueEveryA);
    fam(d.V, d.U, d.b, d.offB, Math.min(...vs), Math.max(...vs), d.avenueEveryB);
  });

  // district boundaries are avenues
  boundaryRoads.forEach(([a, b]) => {
    const l = len(sub(b, a));
    if (l < 5) return;
    const dir = mul(sub(b, a), 1 / l);
    roads.push({ pts: [sub(a, mul(dir, 1.5)), add(b, mul(dir, 1.5))], cls: 1, closeOffset: null, drop: 0 });
  });

  // diagonal arterials: periodic lines (direction p,q integer) with a gentle wiggle
  const dirs: [number, number][] = [
    [1, 1],
    [1, -1],
    [2, 1],
    [1, -2],
    [2, -1],
    [1, 2],
  ];
  const nArt = 4;
  for (let k = 0; k < nArt; k++) {
    const [p, q] = dirs[k];
    const D = v(p * W, q * W);
    const L = len(D);
    const T = mul(D, 1 / L);
    const N = v(-T.y, T.x);
    const o = v(range(rng, 0, W), range(rng, 0, W));
    const amp1 = range(rng, 10, 28);
    const amp2 = range(rng, 3, 8);
    const k1 = irange(rng, 2, 4);
    const k2 = irange(rng, 6, 9);
    const ph1 = range(rng, 0, 6.28);
    const ph2 = range(rng, 0, 6.28);
    const n = Math.ceil(L / 15);
    const pts: V2[] = [];
    for (let s = 0; s < n; s++) {
      const t = (s / n) * L;
      const w = amp1 * Math.sin((6.2832 * k1 * t) / L + ph1) + amp2 * Math.sin((6.2832 * k2 * t) / L + ph2);
      pts.push(add(add(o, mul(T, t)), mul(N, w)));
    }
    roads.push({ pts, cls: 2, closeOffset: D, drop: 0 });
  }

  // ring road around downtown
  {
    const c = districts[0].seed;
    const R = range(rng, 620, 720);
    const ph = range(rng, 0, 6.28);
    const pts: V2[] = [];
    // a partial ring (about 230°), so it reads as a ring-road arc
    const n = 160;
    for (let s = 0; s <= n; s++) {
      const a = ph + (s / n) * Math.PI * 1.28;
      const r = R * (1 + 0.07 * Math.sin(2 * a + ph) + 0.04 * Math.sin(3 * a + 2 * ph));
      pts.push(add(c, v(Math.cos(a) * r, Math.sin(a) * r * 0.86)));
    }
    roads.push({ pts, cls: 1, closeOffset: null, drop: 0 });
  }

  // ---- intersections (spatial hash on the torus) ----
  const CELL = 40;
  const NC = Math.ceil(W / CELL);
  interface Piece {
    road: number;
    seg: number;
    t0: number;
    t1: number;
    a: V2;
    b: V2;
  }
  const pieces: Piece[] = [];
  const buckets: number[][] = Array.from({ length: NC * NC }, () => []);
  const roadSegs = (r: Road) => {
    const segs: [V2, V2][] = [];
    for (let i = 0; i < r.pts.length - 1; i++) segs.push([r.pts[i], r.pts[i + 1]]);
    if (r.closeOffset) segs.push([r.pts[r.pts.length - 1], add(r.pts[0], r.closeOffset)]);
    return segs;
  };
  roads.forEach((r, ri) => {
    roadSegs(r).forEach(([A, B], si) => {
      const l = len(sub(B, A));
      const n = Math.max(1, Math.ceil(l / 30));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        const pa = lerpV(A, B, t0);
        const pb = lerpV(A, B, t1);
        const idx = pieces.length;
        pieces.push({ road: ri, seg: si, t0, t1, a: pa, b: pb });
        const cx0 = Math.floor(Math.min(pa.x, pb.x) / CELL);
        const cx1 = Math.floor(Math.max(pa.x, pb.x) / CELL);
        const cy0 = Math.floor(Math.min(pa.y, pb.y) / CELL);
        const cy1 = Math.floor(Math.max(pa.y, pb.y) / CELL);
        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++) buckets[mod(cy, NC) * NC + mod(cx, NC)].push(idx);
      }
    });
  });

  // nodes with merging
  const nodes: V2[] = [];
  const nodeHash = new Map<number, number[]>();
  const NH = Math.ceil(W / 2);
  const getNode = (p: V2) => {
    const x = mod(p.x, W);
    const y = mod(p.y, W);
    const cx = Math.floor(x / 2);
    const cy = Math.floor(y / 2);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const key = mod(cy + dy, NH) * NH + mod(cx + dx, NH);
        const list = nodeHash.get(key);
        if (!list) continue;
        for (const ni of list) if (torusDist(nodes[ni], v(x, y)) < 0.9) return ni;
      }
    const id = nodes.length;
    nodes.push(v(x, y));
    const key = cy * NH + cx;
    const list = nodeHash.get(key);
    if (list) list.push(id);
    else nodeHash.set(key, [id]);
    return id;
  };

  // per road: list of (param, node)
  const hits: { p: number; n: number }[][] = roads.map(() => []);
  const tested = new Set<number>();
  for (const bucket of buckets) {
    for (let x = 0; x < bucket.length; x++) {
      for (let y = x + 1; y < bucket.length; y++) {
        const i = bucket[x];
        const j = bucket[y];
        const A = pieces[i];
        const B = pieces[j];
        if (A.road === B.road) continue;
        const key = i < j ? i * 1e6 + j : j * 1e6 + i;
        if (tested.has(key)) continue;
        tested.add(key);
        // shift B near A on the torus
        const ma = lerpV(A.a, A.b, 0.5);
        const mb = lerpV(B.a, B.b, 0.5);
        const sx = Math.round((mb.x - ma.x) / W) * W;
        const sy = Math.round((mb.y - ma.y) / W) * W;
        const b0 = v(B.a.x - sx, B.a.y - sy);
        const b1 = v(B.b.x - sx, B.b.y - sy);
        const r = sub(A.b, A.a);
        const s = sub(b1, b0);
        const den = r.x * s.y - r.y * s.x;
        if (Math.abs(den) < 1e-9) continue;
        const qp = sub(b0, A.a);
        const t = (qp.x * s.y - qp.y * s.x) / den;
        const u = (qp.x * r.y - qp.y * r.x) / den;
        if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
        const P = add(A.a, mul(r, t));
        const n = getNode(P);
        hits[A.road].push({ p: A.seg + A.t0 + (A.t1 - A.t0) * t, n });
        hits[B.road].push({ p: B.seg + B.t0 + (B.t1 - B.t0) * u, n });
      }
    }
  }

  // ---- edges ----
  const edgesAll: (Edge & { drop: number })[] = [];
  const pointAt = (r: Road, prm: number): V2 => {
    const nseg = r.pts.length - 1 + (r.closeOffset ? 1 : 0);
    const si = Math.min(nseg - 1, Math.max(0, Math.floor(prm)));
    const t = prm - si;
    const A = r.pts[si];
    const B = si + 1 < r.pts.length ? r.pts[si + 1] : add(r.pts[0], r.closeOffset!);
    return lerpV(A, B, t);
  };
  const vertexAt = (r: Road, i: number): V2 => (i < r.pts.length ? r.pts[i] : add(r.pts[i - r.pts.length], r.closeOffset!));
  const subPolyline = (r: Road, p0: number, p1: number): V2[] => {
    // p1 may exceed nseg for closed roads (wrap)
    const nseg = r.pts.length - 1 + (r.closeOffset ? 1 : 0);
    const out: V2[] = [];
    const at = (prm: number) => {
      if (prm <= nseg) return pointAt(r, prm);
      const q = pointAt(r, prm - nseg);
      return add(q, r.closeOffset!);
    };
    out.push(at(p0));
    for (let i = Math.floor(p0) + 1; i < p1; i++) {
      if (i <= nseg) out.push(i === nseg ? add(r.pts[0], r.closeOffset!) : vertexAt(r, i));
      else out.push(add(vertexAt(r, i - nseg), r.closeOffset!));
    }
    out.push(at(p1));
    return out;
  };
  const polyLen = (pts: V2[]) => {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += len(sub(pts[i], pts[i - 1]));
    return s;
  };

  roads.forEach((r, ri) => {
    const nseg = r.pts.length - 1 + (r.closeOffset ? 1 : 0);
    const h = hits[ri].sort((a, b) => a.p - b.p);
    const list: { p: number; n: number }[] = [];
    for (const x of h) {
      if (list.length && (list[list.length - 1].n === x.n || x.p - list[list.length - 1].p < 1e-6)) continue;
      list.push(x);
    }
    if (!r.closeOffset) {
      if (!list.length || list[0].p > 1e-6) list.unshift({ p: 0, n: getNode(r.pts[0]) });
      if (list[list.length - 1].p < nseg - 1e-6) list.push({ p: nseg, n: getNode(r.pts[r.pts.length - 1]) });
      for (let k = 0; k < list.length - 1; k++) {
        const pts = subPolyline(r, list[k].p, list[k + 1].p);
        edgesAll.push({ pts, cls: r.cls, n0: list[k].n, n1: list[k + 1].n, len: polyLen(pts), drop: r.drop });
      }
    } else {
      if (list.length < 1) return;
      for (let k = 0; k < list.length; k++) {
        const a = list[k];
        const b = k + 1 < list.length ? list[k + 1] : { p: list[0].p + nseg, n: list[0].n };
        if (a.n === b.n && list.length > 1) continue;
        const pts = subPolyline(r, a.p, b.p);
        edgesAll.push({ pts, cls: r.cls, n0: a.n, n1: b.n, len: polyLen(pts), drop: r.drop });
      }
    }
  });

  // remove edges in water / parks / lots, random gaps in local streets
  const degree = new Int32Array(nodes.length);
  const kept: Edge[] = [];
  const keepFlags = edgesAll.map((e) => {
    if (e.len < 0.5) return false;
    const mid = e.pts[Math.floor(e.pts.length / 2)];
    const m = e.pts.length === 2 ? lerpV(e.pts[0], e.pts[1], 0.5) : mid;
    if (e.cls < 2) {
      if (inWater(m)) return false;
      // a street is inside a park only if both sides are park
      const a = e.pts[0];
      const b = e.pts[e.pts.length - 1];
      const dir = sub(b, a);
      const l = len(dir) || 1;
      const nrm = v(-dir.y / l, dir.x / l);
      if (inParkOrLot(add(m, mul(nrm, 3))) && inParkOrLot(add(m, mul(nrm, -3)))) return false;
    }
    if (e.cls === 0 && e.len > 6 && chance(rng, e.drop)) return false;
    return true;
  });
  edgesAll.forEach((e, i) => {
    if (!keepFlags[i]) return;
    degree[e.n0]++;
    degree[e.n1]++;
  });
  // prune tiny dead-end stubs (the 1.5m overshoots past boundary avenues)
  edgesAll.forEach((e, i) => {
    if (!keepFlags[i]) return;
    if (e.len < 5 && (degree[e.n0] === 1 || degree[e.n1] === 1)) {
      keepFlags[i] = false;
      degree[e.n0]--;
      degree[e.n1]--;
    }
  });
  edgesAll.forEach((e, i) => {
    if (keepFlags[i]) kept.push({ pts: e.pts, cls: e.cls, n0: e.n0, n1: e.n1, len: e.len });
  });

  // ---- buildings (only drawn in the City HUD look) ----
  const buildings: Building[] = [];
  districts.forEach((d, di) => {
    const ind = d.kind === "industrial";
    const us = d.poly.map((p) => dot(p, d.U));
    const vs = d.poly.map((p) => dot(p, d.V));
    const i0 = Math.floor((Math.min(...us) - d.offA) / d.a);
    const i1 = Math.ceil((Math.max(...us) - d.offA) / d.a);
    const j0 = Math.floor((Math.min(...vs) - d.offB) / d.b);
    const j1 = Math.ceil((Math.max(...vs) - d.offB) / d.b);
    const brng = mulberry32(seed * 31 + di * 7919);
    const P = (uu: number, vv: number) => add(mul(d.U, uu), mul(d.V, vv));
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        if (parkBlocks.has(`${di}:${i}:${j}`)) continue;
        const u0 = d.offA + i * d.a + 1.8;
        const u1 = d.offA + (i + 1) * d.a - 1.8;
        const v0 = d.offB + j * d.b + 1.8;
        const v1 = d.offB + (j + 1) * d.b - 1.8;
        const cen = P((u0 + u1) / 2, (v0 + v1) / 2);
        const cw = d.warp ? warp(cen) : cen;
        if (!pointInPoly(cen, d.poly) || inWater(cw) || inParkOrLot(cw)) continue;
        // lots along the long side, on both long edges
        const alongU = u1 - u0 > v1 - v0;
        const L0 = alongU ? u0 : v0;
        const L1 = alongU ? u1 : v1;
        const S0 = alongU ? v0 : u0;
        const S1 = alongU ? v1 : u1;
        const depthMax = (S1 - S0) / 2;
        for (const side of [0, 1]) {
          let x = L0;
          while (x < L1 - 3) {
            const w = Math.min(L1 - x, ind ? range(brng, 8, 20) : range(brng, 3, 7));
            if (brng() < (ind ? 0.7 : 0.88)) {
              const dd = Math.min(depthMax - 0.8, ind ? range(brng, 6, 15) : range(brng, 3, 8));
              const g = range(brng, 0.6, 1.2);
              const a0 = x + g * 0.5;
              const a1 = x + w - g * 0.5;
              const b0 = side === 0 ? S0 : S1 - dd;
              const b1 = side === 0 ? S0 + dd : S1;
              const corners = alongU
                ? [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)]
                : [P(b0, a0), P(b1, a0), P(b1, a1), P(b0, a1)];
              buildings.push({ pts: d.warp ? corners.map(warp) : corners, shade: brng() });
            }
            x += w;
          }
        }
        // occasional big inner building
        if (brng() < 0.25 && depthMax > 14) {
          const m = (S0 + S1) / 2;
          const a0 = L0 + range(brng, 4, 10);
          const a1 = L1 - range(brng, 4, 10);
          const corners = alongU
            ? [P(a0, m - 3), P(a1, m - 3), P(a1, m + 3), P(a0, m + 3)]
            : [P(m - 3, a0), P(m + 3, a0), P(m + 3, a1), P(m - 3, a1)];
          buildings.push({ pts: d.warp ? corners.map(warp) : corners, shade: brng() });
        }
      }
    }
  });

  // ---- little dashed "text" labels near avenues (flyover look) ----
  const labels: City["labels"] = [];
  {
    const lr = mulberry32(seed + 99);
    const avs = kept.filter((e) => e.cls >= 1 && e.len > 25);
    for (let k = 0; k < 520 && avs.length; k++) {
      const e = pick(lr, avs);
      const t = range(lr, 0.2, 0.8);
      const a = e.pts[0];
      const b = e.pts[e.pts.length - 1];
      const dir = sub(b, a);
      const l = len(dir) || 1;
      const nrm = v(-dir.y / l, dir.x / l);
      const p = add(lerpV(a, b, t), mul(nrm, (chance(lr, 0.5) ? 1 : -1) * range(lr, 18, 30)));
      if (inWater(p)) continue;
      labels.push({ p, angle: Math.atan2(dir.y, dir.x), n: irange(lr, 3, 7) });
    }
  }

  // ---- tracker route: a closed loop on the street graph ----
  const route = buildRoute(rng, W, nodes, kept, degree, districts, inWater, torusDelta);

  return {
    W,
    seed,
    districts,
    nodes,
    edges: kept,
    water,
    parks,
    lots,
    rails,
    buildings,
    labels,
    route,
    inWater,
  };
};

// Dijkstra between waypoints placed on a circle; total length ~2.5 km.
const buildRoute = (
  rng: Rng,
  W: number,
  nodes: V2[],
  edges: Edge[],
  degree: Int32Array,
  districts: District[],
  inWater: (p: V2) => boolean,
  torusDelta: (a: number, b: number) => number,
): Route => {
  const adj: { to: number; e: number }[][] = nodes.map(() => []);
  edges.forEach((e, i) => {
    adj[e.n0].push({ to: e.n1, e: i });
    adj[e.n1].push({ to: e.n0, e: i });
  });
  const dijkstra = (src: number, dst: number, penalty: Float64Array) => {
    const dist = new Float64Array(nodes.length).fill(Infinity);
    const prevE = new Int32Array(nodes.length).fill(-1);
    const heap: [number, number][] = [[0, src]];
    dist[src] = 0;
    const push = (item: [number, number]) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      if (u === dst) break;
      for (const { to, e } of adj[u]) {
        const ed = edges[e];
        // prefer bigger streets a little, avoid reuse strongly
        const w = ed.len * (ed.cls === 0 ? 1.15 : 1) * penalty[e];
        if (d + w < dist[to]) {
          dist[to] = d + w;
          prevE[to] = e;
          push([d + w, to]);
        }
      }
    }
    if (!isFinite(dist[dst])) return null;
    const path: { e: number; from: number }[] = [];
    let u = dst;
    while (u !== src) {
      const e = prevE[u];
      const ed = edges[e];
      const from = ed.n0 === u ? ed.n1 : ed.n0;
      path.push({ e, from });
      u = from;
    }
    return path.reverse();
  };

  const tryRoute = (center: V2, R: number, phase0: number) => {
    const K = 6;
    const wps: number[] = [];
    for (let k = 0; k < K; k++) {
      const a = phase0 + (k / K) * Math.PI * 2;
      const target = { x: center.x + Math.cos(a) * R, y: center.y + Math.sin(a) * R };
      let best = -1;
      let bd = Infinity;
      nodes.forEach((n, i) => {
        if (degree[i] < 3) return;
        const d = Math.hypot(torusDelta(target.x, n.x), torusDelta(target.y, n.y));
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0 || bd > 80) return null;
      wps.push(best);
    }
    const penalty = new Float64Array(edges.length).fill(1);
    const legs: { e: number; from: number }[] = [];
    for (let k = 0; k < K; k++) {
      const path = dijkstra(wps[k], wps[(k + 1) % K], penalty);
      if (!path) return null;
      path.forEach((s) => {
        penalty[s.e] = 8;
        legs.push(s);
      });
    }
    // reject loops that reuse an edge
    const used = new Set<number>();
    for (const s of legs) {
      if (used.has(s.e)) return null;
      used.add(s.e);
    }
    // assemble continuous polyline
    const pts: V2[] = [];
    for (const s of legs) {
      const ed = edges[s.e];
      let seq = ed.pts;
      if (ed.n0 !== s.from) seq = [...seq].reverse();
      if (ed.n0 === ed.n1) seq = ed.pts;
      if (pts.length) {
        const last = pts[pts.length - 1];
        const ox = Math.round((last.x - seq[0].x) / W) * W;
        const oy = Math.round((last.y - seq[0].y) / W) * W;
        seq = seq.map((p) => ({ x: p.x + ox, y: p.y + oy }));
        for (let i = 1; i < seq.length; i++) pts.push(seq[i]);
      } else pts.push(...seq);
    }
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) > 1) return null;
    pts[pts.length - 1] = { ...first };
    // simplify: drop nearly collinear points
    const simp: V2[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = simp[simp.length - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) > 0.5 || Math.hypot(b.x - a.x, b.y - a.y) > 200) simp.push(b);
    }
    simp.push(pts[pts.length - 1]);
    // round each corner with a fillet (<= 30 m, ~3 px off the centreline at 720p) so the dot flows through turns
    const fil: V2[] = [];
    const m = simp.length - 1; // closed: simp[m] == simp[0]
    for (let i = 0; i < m; i++) {
      const P = simp[i];
      const A = simp[(i - 1 + m) % m];
      const B = simp[i + 1];
      const la = Math.hypot(P.x - A.x, P.y - A.y);
      const lb = Math.hypot(B.x - P.x, B.y - P.y);
      const r = Math.min(30, la / 2.2, lb / 2.2);
      const p0 = { x: P.x + ((A.x - P.x) / la) * r, y: P.y + ((A.y - P.y) / la) * r };
      const p2 = { x: P.x + ((B.x - P.x) / lb) * r, y: P.y + ((B.y - P.y) / lb) * r };
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const u = 1 - t;
        fil.push({ x: u * u * p0.x + 2 * u * t * P.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * P.y + t * t * p2.y });
      }
    }
    fil.push({ ...fil[0] });
    simp.length = 0;
    simp.push(...fil);
    const cum = [0];
    for (let i = 1; i < simp.length; i++) cum.push(cum[i - 1] + Math.hypot(simp[i].x - simp[i - 1].x, simp[i].y - simp[i - 1].y));
    return { pts: simp, cum, length: cum[cum.length - 1] };
  };

  // try centres in the denser districts, tune the radius to ~2.5 km
  const candidates = districts.filter((d) => d.kind === "grid" || d.kind === "mixed" || d.kind === "downtown");
  let best: Route | null = null;
  for (let attempt = 0; attempt < 60 && !best; attempt++) {
    const d = candidates[attempt % candidates.length];
    const center = {
      x: d.seed.x + range(rng, -150, 150),
      y: d.seed.y + range(rng, -150, 150),
    };
    if (inWater(center)) continue;
    const phase0 = range(rng, 0, 6.28);
    let R = 300;
    for (let it = 0; it < 8; it++) {
      const r = tryRoute(center, R, phase0);
      if (!r) break;
      if (Math.abs(r.length - 2500) < 120) {
        best = r;
        break;
      }
      R *= Math.pow(2500 / r.length, 0.8);
    }
  }
  if (!best) throw new Error("no tracker route found; try another city seed");
  return best;
};
