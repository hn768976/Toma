import * as THREE from "three";
import { fbm3, mulberry32, pick, range, type Rng } from "../lib/random";
import { REG, regionUV, type RegionName } from "./textures";

// A parcel is built from one analytic surface (rounded box + bulge + dents
// + crumple). Body, tape and decals are all sampled from that same surface,
// so tape and labels hug the cardboard instead of floating on it.

type V3 = [number, number, number];
interface Face { n: V3; U: V3; V: V3; axis: number; uAxis: number; vAxis: number }
// U x V = n for every face (outward, CCW winding).
const FACES: Face[] = [
  { n: [1, 0, 0], U: [0, 0, -1], V: [0, 1, 0], axis: 0, uAxis: 2, vAxis: 1 },
  { n: [-1, 0, 0], U: [0, 0, 1], V: [0, 1, 0], axis: 0, uAxis: 2, vAxis: 1 },
  { n: [0, 1, 0], U: [1, 0, 0], V: [0, 0, -1], axis: 1, uAxis: 0, vAxis: 2 },
  { n: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1], axis: 1, uAxis: 0, vAxis: 2 },
  { n: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0], axis: 2, uAxis: 0, vAxis: 1 },
  { n: [0, 0, -1], U: [-1, 0, 0], V: [0, 1, 0], axis: 2, uAxis: 0, vAxis: 1 },
];
export const FACE = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 } as const;

export interface ShapeParams {
  size: V3; // full extents x (length along belt), y (height), z (depth)
  radius: number;
  bulge: number; // metres of face bulge (+-)
  crumple: number; // metres of high-frequency crumple (mailers)
  dents: number[]; // corner indices 0..7 that carry a dent
  seed: number;
  soft: boolean; // mailer: pillow-like, edges pinched
}

export class ParcelShape {
  readonly h: V3;
  constructor(readonly p: ShapeParams) {
    this.h = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
  }
  // Surface point for face f at in-face coords (a along U, b along V).
  point(f: number, a: number, b: number, out: THREE.Vector3) {
    const F = FACES[f];
    const { h } = this;
    const r = this.p.radius;
    const raw: V3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) raw[k] = F.n[k] * h[F.axis] + F.U[k] * a + F.V[k] * b;
    // rounding: clamp to the inner box, push out by r
    const c: V3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) c[k] = Math.max(-(h[k] - r), Math.min(h[k] - r, raw[k]));
    let dx = raw[0] - c[0], dy = raw[1] - c[1], dz = raw[2] - c[2];
    let l = Math.hypot(dx, dy, dz);
    if (l < 1e-9) { dx = F.n[0]; dy = F.n[1]; dz = F.n[2]; l = 1; }
    dx /= l; dy /= l; dz /= l;
    let x = c[0] + dx * r, y = c[1] + dy * r, z = c[2] + dz * r;
    // distance to the nearest edge, in the face plane
    const ea = h[F.uAxis] - Math.abs(a), eb = h[F.vAxis] - Math.abs(b);
    const edge = Math.min(ea, eb);
    // bulge: large faces swell slightly, fading to zero at edges; flat bottom
    if (!(F.axis === 1 && F.n[1] < 0)) {
      const fade = Math.min(1, ea / 0.07) * Math.min(1, eb / 0.07);
      const nz = fbm3(x * 3.1, y * 3.1, z * 3.1, this.p.seed, 2);
      const sw = this.p.bulge * (0.55 + 0.45 * nz) * fade * fade;
      x += dx * sw; y += dy * sw; z += dz * sw;
      if (this.p.crumple > 0) {
        const cr = fbm3(x * 34, y * 34, z * 34, this.p.seed + 7, 3) * this.p.crumple * Math.min(1, edge / 0.01 + 0.3);
        x += dx * cr; y += dy * cr; z += dz * cr;
      }
    }
    if (this.p.soft) {
      // pinch the vertical edges of a mailer so it reads as a soft pouch
      const ty = Math.abs(y) / h[1];
      const pinch = 1 - 0.08 * ty * ty;
      x *= 1 - (1 - pinch) * 0.25;
      z *= pinch;
    }
    // corner dents
    for (const ci of this.p.dents) {
      const cx = (ci & 1 ? 1 : -1) * h[0], cy = (ci & 2 ? 1 : -1) * h[1], cz = (ci & 4 ? 1 : -1) * h[2];
      const d = Math.hypot(x - cx, y - cy, z - cz);
      if (d < 0.05) {
        const k = (1 - d / 0.05) ** 2 * 0.009;
        x -= Math.sign(cx) * k; y -= Math.sign(cy) * k * 0.6; z -= Math.sign(cz) * k;
      }
    }
    out.set(x, y, z);
    return edge;
  }
  normal(f: number, a: number, b: number, out: THREE.Vector3) {
    const e = 0.0007;
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3(), p4 = new THREE.Vector3();
    this.point(f, a - e, b, p1);
    this.point(f, a + e, b, p2);
    this.point(f, a, b - e, p3);
    this.point(f, a, b + e, p4);
    p2.sub(p1);
    p4.sub(p3);
    out.crossVectors(p2, p4).normalize();
    if (!Number.isFinite(out.x)) out.set(...FACES[f].n);
    return out;
  }
  faceHalf(f: number): [number, number] {
    const F = FACES[f];
    return [this.h[F.uAxis], this.h[F.vAxis]];
  }
}

// Axis samples: dense near the edges (rounding + edge grime), coarse inside.
const axisSamples = (half: number, r: number, step: number) => {
  const near = [0, 0.15, 0.35, 0.6, 0.85, 1].map((t) => t * r).concat([0.008, 0.015, 0.025, 0.04]);
  const set = new Set<number>();
  for (const d of near) if (d < half) { set.add(-half + d); set.add(half - d); }
  const n = Math.max(1, Math.ceil((2 * half) / step));
  for (let i = 0; i <= n; i++) set.add(-half + (2 * half * i) / n);
  return [...set].sort((p, q) => p - q);
};

class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col.length) g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Grid over [a0,a1]x[b0,b1] of face f. `offset` lifts it along the normal.
const patch = (
  B: GeoBuilder,
  s: ParcelShape,
  f: number,
  as: number[],
  bs: number[],
  offset: number | ((a: number, b: number) => number),
  uvf: (a: number, b: number) => [number, number],
  colf?: (a: number, b: number, edge: number) => [number, number, number],
) => {
  const base = B.pos.length / 3;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (const b of bs) {
    for (const a of as) {
      const edge = s.point(f, a, b, p);
      s.normal(f, a, b, n);
      p.addScaledVector(n, typeof offset === "number" ? offset : offset(a, b));
      B.pos.push(p.x, p.y, p.z);
      B.nor.push(n.x, n.y, n.z);
      const [u, v] = uvf(a, b);
      B.uv.push(u, v);
      if (colf) B.col.push(...colf(a, b, edge));
    }
  }
  const na = as.length;
  for (let j = 0; j < bs.length - 1; j++) {
    for (let i = 0; i < na - 1; i++) {
      const k = base + j * na + i;
      B.idx.push(k, k + 1, k + na + 1, k, k + na + 1, k + na);
    }
  }
};

const lin = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

// ------------------------------------------------------------- parcels --
export type ParcelKind = "tall" | "medium" | "flat" | "mailer";

export interface DecalSpec { face: number; region: RegionName; a: number; b: number; w: number; ink: boolean; h?: number }

export interface ParcelGeo {
  body: THREE.BufferGeometry;
  tape: THREE.BufferGeometry;
  paper: THREE.BufferGeometry | null; // white labels
  ink: THREE.BufferGeometry | null; // printed symbols
  size: V3;
  kind: ParcelKind;
}

const sideFaces = [FACE.pz, FACE.nz, FACE.px, FACE.nx];

export const makeParcel = (kind: ParcelKind, seed: number, opts: { size?: V3; decals?: DecalSpec[]; tint?: number; front?: number; lowpoly?: boolean } = {}): ParcelGeo => {
  const rng = mulberry32(seed);
  let size: V3;
  if (opts.size) size = opts.size;
  else if (kind === "tall") size = [range(rng, 0.3, 0.42), range(rng, 0.35, 0.45), range(rng, 0.3, 0.4)];
  else if (kind === "medium") size = [range(rng, 0.32, 0.45), range(rng, 0.22, 0.32), range(rng, 0.28, 0.4)];
  else if (kind === "flat") size = [range(rng, 0.24, 0.3), range(rng, 0.09, 0.11), range(rng, 0.16, 0.22)];
  else size = [range(rng, 0.28, 0.32), 0.06, range(rng, 0.19, 0.22)];
  const soft = kind === "mailer";
  const dents: number[] = [];
  if (!soft && rng() < 0.65) dents.push(Math.floor(rng() * 8));
  if (!soft && rng() < 0.3) dents.push(Math.floor(rng() * 8));
  const shape = new ParcelShape({
    size,
    radius: soft ? 0.014 : range(rng, 0.003, 0.005),
    bulge: soft ? 0.004 : 0.0025,
    crumple: soft ? 0.0035 : 0,
    dents,
    seed: seed * 7 + 1,
    soft,
  });
  const tint = opts.tint ?? 1 + (rng() - 0.5) * 0.08; // +-4%
  const tintRB = 1 + (rng() - 0.5) * 0.04;
  const uoff = rng() * 10, voff = rng() * 10;
  const dirtSeed = Math.floor(rng() * 1e6);

  // ---- body
  const body = new GeoBuilder();
  const step = soft ? 0.012 : 0.04;
  for (let f = 0; f < 6; f++) {
    const [hu, hv] = shape.faceHalf(f);
    void hu;
    // lowpoly (background stock, always heavily defocused): a few quads per face
    const as = opts.lowpoly ? lin(-hu, hu, 3) : axisSamples(hu, shape.p.radius, step);
    const bs = opts.lowpoly ? lin(-hv, hv, 3) : axisSamples(hv, shape.p.radius, step);
    patch(body, shape, f, as, bs, 0, (a, b) => [a + uoff + f * 1.37, b + voff + f * 2.11], (a, b, edge) => {
      // darker, dirtier edges and corners
      const e = Math.max(0, edge);
      const grime = 1 - 0.16 * Math.exp(-e / 0.012) - 0.05 * Math.exp(-e / 0.05);
      const blot = 1 + 0.035 * fbm3(a * 9 + f, b * 9, dirtSeed % 97, dirtSeed, 2);
      // baked contact occlusion along the bottom of the side faces
      const sideF = f === FACE.px || f === FACE.nx || f === FACE.pz || f === FACE.nz;
      const contact = sideF ? 1 - 0.28 * Math.exp(-(b + hv) / 0.02) : 1;
      const l = tint * grime * blot * contact * (f === FACE.ny ? 0.6 : 1);
      return [l * tintRB, l, l * (2 - tintRB) * 0.99];
    });
  }

  // ---- tape
  const tape = new GeoBuilder();
  const tw = soft ? 0.04 : 0.048;
  const tapeUV = (along: number, across: number) => [across / tw + 0.5, along + uoff] as [number, number];
  if (!soft) {
    // one strip along the top (over the flap seam) and down both ends
    const hx = shape.h[0], hy = shape.h[1];
    const drop = Math.min(0.065, hy * 0.6);
    const across = lin(-tw / 2, tw / 2, opts.lowpoly ? 1 : 3);
    // top: a along x, b along -z (V = -z)
    patch(tape, shape, FACE.py, opts.lowpoly ? lin(-hx, hx, 2) : axisSamples(hx, shape.p.radius, 0.03), across, 0.0006, (a, b) => tapeUV(a, -b));
    // +x end: U = -z, V = y
    patch(tape, shape, FACE.px, across, lin(hy - drop, hy, opts.lowpoly ? 1 : 8), 0.0006, (a, b) => tapeUV(hx + (hy - b), -a));
    patch(tape, shape, FACE.nx, across, lin(hy - drop, hy, opts.lowpoly ? 1 : 8), 0.0006, (a, b) => tapeUV(-hx - (hy - b), a));
  } else {
    // two bands around the mailer (top, both long sides, bottom)
    for (const t of [-0.27, 0.27]) {
      const x0 = t * size[0];
      const band = lin(x0 - tw / 2, x0 + tw / 2, 3);
      patch(tape, shape, FACE.py, band, axisSamples(shape.h[2], shape.p.radius, 0.012), 0.0007, (a, b) => tapeUV(b, a - x0));
      patch(tape, shape, FACE.ny, band, axisSamples(shape.h[2], shape.p.radius, 0.012), 0.0007, (a, b) => tapeUV(b + 1, a - x0));
      patch(tape, shape, FACE.pz, band, axisSamples(shape.h[1], shape.p.radius, 0.012), 0.0007, (a, b) => tapeUV(b + 2, a - x0));
      patch(tape, shape, FACE.nz, lin(-x0 - tw / 2, -x0 + tw / 2, 3), axisSamples(shape.h[1], shape.p.radius, 0.012), 0.0007, (a, b) => tapeUV(b + 3, a + x0));
    }
  }

  // ---- decals
  let decals = opts.decals;
  if (!decals) {
    decals = [];
    if (soft) {
      decals.push({ face: FACE.py, region: "mini", a: range(rng, -0.02, 0.02), b: range(rng, -0.02, 0.02), w: 0.09, ink: false });
    } else {
      // most cartons carry a recycling mark, many a label, some handling icons
      const faces: number[] = [...sideFaces].sort(() => rng() - 0.5);
      // usually print on the side that will face the camera
      if (opts.front !== undefined && rng() < 0.8) {
        faces.splice(faces.indexOf(opts.front), 1);
        faces.unshift(opts.front);
      }
      const fLabel = faces[0], fRec = rng() < 0.6 ? faces[0] : faces[1];
      const big = kind !== "flat";
      const [hu, hv] = shape.faceHalf(fLabel);
      if (rng() < (big ? 0.8 : 0.6)) {
        const lw = big ? range(rng, 0.085, 0.105) : 0.055;
        const region: RegionName = big ? pick(rng, ["labelA", "labelB"] as const) : "labelC";
        const lh = (lw * REG[region].h) / REG[region].w;
        if (lh < hv * 1.7 && lw < hu * 1.6) {
          decals.push({ face: fLabel, region, a: -hu + lw / 2 + range(rng, 0.03, Math.max(0.031, hu * 0.5)), b: hv - lh / 2 - range(rng, 0.02, 0.04), w: lw, ink: false });
        }
      }
      if (rng() < 0.85) {
        const [ru, rv] = shape.faceHalf(fRec);
        const rw = Math.min(big ? range(rng, 0.11, 0.15) : 0.06, rv * 1.4);
        const region: RegionName = rng() < 0.6 ? "recycleBox" : "recycle";
        decals.push({ face: fRec, region, a: ru - rw / 2 - range(rng, 0.015, 0.03), b: -rv + rw / 2 + range(rng, 0.015, 0.03), w: rw, ink: true });
      }
      // manufacturer's glue joint: a flap strip along one vertical edge
      if (rng() < 0.7) {
        const fj = rng() < 0.5 ? FACE.px : FACE.nx;
        const [ju, jv] = shape.faceHalf(fj);
        const jw = 0.04;
        decals.push({ face: fj, region: "joint", a: (fj === FACE.px ? 1 : -1) * (ju - jw / 2), b: 0, w: jw, h: 2 * jv - 0.004, ink: true });
      }
      if (big && rng() < 0.45) {
        const fh = faces[2];
        const [hu2, hv2] = shape.faceHalf(fh);
        const hw = Math.min(0.15, hu2 * 1.2);
        decals.push({ face: fh, region: "handling", a: range(rng, -hu2 * 0.3, hu2 * 0.3), b: hv2 - hw / 6 - 0.05, w: hw, ink: true });
      }
    }
  }
  const paper = new GeoBuilder();
  const ink = new GeoBuilder();
  for (const d of decals) {
    const R = REG[d.region];
    const hgt = d.h ?? (d.w * R.h) / R.w;
    const uvr = regionUV(R);
    const sub = soft ? 18 : opts.lowpoly ? 1 : 6; // follow the crumpled surface closely
    const as = lin(d.a - d.w / 2, d.a + d.w / 2, sub);
    const bs = lin(d.b - hgt / 2, d.b + hgt / 2, sub);
    // paper labels: one corner lifts a little (curl), so it catches light
    const base = d.ink ? 0.0003 : soft ? 0.003 : 0.0009;
    const cs = d.a > 0 ? 1 : -1;
    const curl = d.ink ? base : (a: number, b: number) => {
      const u = ((a - d.a) / d.w) * cs + 0.5, v = (b - d.b) / hgt + 0.5; // 1,1 = lifted corner
      const k = Math.max(0, u + v - 1.45) / 0.55;
      return base + k * k * 0.004;
    };
    patch(d.ink ? ink : paper, shape, d.face, as, bs, curl, (a, b) => [
      uvr.u0 + ((a - (d.a - d.w / 2)) / d.w) * (uvr.u1 - uvr.u0),
      uvr.v0 + ((b - (d.b - hgt / 2)) / hgt) * (uvr.v1 - uvr.v0),
    ]);
  }
  return {
    body: body.build(),
    tape: tape.build(),
    paper: paper.pos.length ? paper.build() : null,
    ink: ink.pos.length ? ink.build() : null,
    size,
    kind,
  };
};

// The 1B hero panel: a flat 11 x 17 cm rectangle on the +z face.
export const heroPanelGeometry = (shape: { size: V3 }, a: number, b: number, w = 0.11, h = 0.17) => {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(a, b, shape.size[2] / 2 + 0.0035);
  return g;
};

export const randomKind = (rng: Rng): ParcelKind => {
  const r = rng();
  return r < 0.27 ? "tall" : r < 0.67 ? "medium" : r < 0.9 ? "flat" : "mailer";
};
