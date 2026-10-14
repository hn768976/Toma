// Nested logarithmic-spiral bands standing on edge, with rounded tops.
//
// Plan (x, z) is static; per frame only the heights ripple. Neighbour
// distances for the ambient occlusion are found once at load by marching
// along each wall normal, so the per-frame AO is a cheap closed form.
import * as THREE from "three";
import { mulberry32, range, TAU } from "../lib/random";

export const BANDS = 20;
export const SAMPLES = 900;
export const HEIGHT = 0.25;
export const THICK = 0.015;
const SIDE_ROWS = [0, 0.06, 0.16, 0.32, 0.52, 0.72, 0.88, 1.0]; // of the straight part
const ARC = 7; // points on the rounded top (excl. ends)
const PROFILE = SIDE_ROWS.length * 2 + ARC;

export type Band = {
  px: Float32Array; // plan x per sample
  pz: Float32Array;
  nx: Float32Array; // outward plan normal
  nz: Float32Array;
  ripPh: number;
  ripK: number;
  // neighbour across +n / -n: distance and (band, sample) for its height
  dOut: Float32Array;
  hOutRef: Int32Array;
  dIn: Float32Array;
  hInRef: Int32Array;
};

export type SpiralGeom = {
  bands: Band[];
  geometry: THREE.BufferGeometry;
  floor: THREE.BufferGeometry;
  floorRefs: { d1: Float32Array; d2: Float32Array; r1: Int32Array; r2: Int32Array };
};

// Every band lies on a member of one logarithmic-spiral family
// r = C_i e^(B theta), with the C_i spread evenly over one turn's ratio.
// Members of such a family never cross, however long the bands are, so the
// bands nest with gaps that grow in proportion to the radius.
const B = 0.42;
const STRETCH = 1.55; // elongates the loops along x, as in the reference

export const buildSpiral = (seed: number): SpiralGeom => {
  const rng = mulberry32(seed);
  const bands: Band[] = [];
  const turnRatio = Math.exp(B * TAU);
  for (let i = 0; i < BANDS; i++) {
    const C = Math.pow(turnRatio, i / BANDS);
    // Start radii log-spread, so arcs of about half a turn cover the frame
    // from the eye outwards.
    // Inner ends gather round the eye; the bands then run as long
    // continuous arcs out of frame.
    const r0 = 0.1 * Math.exp(range(rng, 0, Math.log(2.6)));
    const th0 = Math.log(r0 / C) / B;
    const span = TAU * range(rng, 1.1, 1.35);
    const px = new Float32Array(SAMPLES);
    const pz = new Float32Array(SAMPLES);
    const nx = new Float32Array(SAMPLES);
    const nz = new Float32Array(SAMPLES);
    for (let s = 0; s < SAMPLES; s++) {
      const th = th0 + (s / (SAMPLES - 1)) * span;
      const r = C * Math.exp(B * th);
      px[s] = r * Math.cos(th) * STRETCH;
      pz[s] = r * Math.sin(th);
    }
    for (let s = 0; s < SAMPLES; s++) {
      const s0 = Math.max(0, s - 1);
      const s1 = Math.min(SAMPLES - 1, s + 1);
      const tx = px[s1] - px[s0];
      const tz = pz[s1] - pz[s0];
      const l = Math.hypot(tx, tz) || 1;
      // Outward normal (away from the spiral centre).
      let ox = tz / l;
      let oz = -tx / l;
      if (ox * px[s] + oz * pz[s] < 0) { ox = -ox; oz = -oz; }
      nx[s] = ox;
      nz[s] = oz;
    }
    bands.push({
      px, pz, nx, nz,
      ripPh: rng() * TAU,
      ripK: 1 + Math.floor(rng() * 2),
      dOut: new Float32Array(SAMPLES),
      hOutRef: new Int32Array(SAMPLES).fill(-1),
      dIn: new Float32Array(SAMPLES),
      hInRef: new Int32Array(SAMPLES).fill(-1),
    });
  }

  // Spatial hash of all wall samples for neighbour queries.
  const CELL = 0.05;
  const grid = new Map<number, number[]>();
  const key = (x: number, z: number) => (Math.floor(x / CELL) + 4096) * 8192 + (Math.floor(z / CELL) + 4096);
  bands.forEach((b, bi) => {
    for (let s = 0; s < SAMPLES; s++) {
      const k = key(b.px[s], b.pz[s]);
      let arr = grid.get(k);
      if (!arr) grid.set(k, (arr = []));
      arr.push(bi * SAMPLES + s);
    }
  });
  // Nearest wall sample to (x, z), skipping samples of band `skipBand` within
  // `skipArc` samples of `skipS`.
  const nearest = (x: number, z: number, skipBand: number, skipS: number) => {
    let best = -1;
    let bd = Infinity;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const arr = grid.get((cx + dx + 4096) * 8192 + (cz + dz + 4096));
        if (!arr) continue;
        for (const id of arr) {
          const bi = (id / SAMPLES) | 0;
          const s = id % SAMPLES;
          if (bi === skipBand && Math.abs(s - skipS) < 25) continue;
          const b = bands[bi];
          const d = Math.hypot(b.px[s] - x, b.pz[s] - z);
          if (d < bd) { bd = d; best = id; }
        }
      }
    return { id: best, d: bd };
  };
  const MAXD = 1.2;
  // Sphere tracing: step by the distance to the nearest wall sample.
  const march = (x: number, z: number, dx: number, dz: number, bi: number, s: number) => {
    let t = 0.012;
    while (t < MAXD) {
      const q = nearest(x + dx * t, z + dz * t, bi, s);
      if (q.id >= 0 && q.d < 0.012) return { d: t, id: q.id };
      t += Math.max(0.006, Math.min(q.d, CELL) * 0.8);
    }
    return { d: MAXD, id: -1 };
  };
  bands.forEach((b, bi) => {
    for (let s = 0; s < SAMPLES; s++) {
      const o = march(b.px[s], b.pz[s], b.nx[s], b.nz[s], bi, s);
      b.dOut[s] = o.d;
      b.hOutRef[s] = o.id;
      const n = march(b.px[s], b.pz[s], -b.nx[s], -b.nz[s], bi, s);
      b.dIn[s] = n.d;
      b.hInRef[s] = n.id;
    }
  });

  // Smooth the marched gap distances along each band: the march is
  // quantised, and unsmoothed it shows as vertical streaks on the walls.
  const smooth = (a: Float32Array) => {
    const out = new Float32Array(a.length);
    const R = 10;
    for (let i = 0; i < a.length; i++) {
      let sum = 0;
      let w = 0;
      for (let k = -R; k <= R; k++) {
        const j = i + k;
        if (j < 0 || j >= a.length) continue;
        const wk = 1 - Math.abs(k) / (R + 1);
        sum += a[j] * wk;
        w += wk;
      }
      out[i] = sum / w;
    }
    a.set(out);
  };
  bands.forEach((b) => { smooth(b.dOut); smooth(b.dIn); });

  // Wall mesh: per sample a profile of PROFILE points.
  const wallVerts = BANDS * SAMPLES * PROFILE;
  const vcount = wallVerts + BANDS * 2 * PROFILE; // + square end caps
  const pos = new Float32Array(vcount * 3);
  const nor = new Float32Array(vcount * 3);
  const col = new Float32Array(vcount * 3).fill(1);
  const index: number[] = [];
  for (let bi = 0; bi < BANDS; bi++) {
    for (let s = 0; s < SAMPLES - 1; s++) {
      for (let p = 0; p < PROFILE - 1; p++) {
        const a = (bi * SAMPLES + s) * PROFILE + p;
        const b = a + PROFILE;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  for (let bi = 0; bi < BANDS; bi++) {
    for (let e = 0; e < 2; e++) {
      const base = wallVerts + (bi * 2 + e) * PROFILE;
      for (let p = 1; p < PROFILE - 1; p++) {
        if (e === 0) index.push(base, base + p + 1, base + p);
        else index.push(base, base + p, base + p + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geometry.setIndex(index);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

  // Floor: a dense grid; each vertex knows its two nearest walls.
  const FN = 260;
  const FE = 6.5;
  const fpos = new Float32Array((FN + 1) * (FN + 1) * 3);
  const fcol = new Float32Array((FN + 1) * (FN + 1) * 3).fill(1);
  const d1 = new Float32Array((FN + 1) * (FN + 1));
  const d2 = new Float32Array((FN + 1) * (FN + 1));
  const r1 = new Int32Array((FN + 1) * (FN + 1));
  const r2 = new Int32Array((FN + 1) * (FN + 1));
  const findex: number[] = [];
  for (let j = 0; j <= FN; j++)
    for (let i = 0; i <= FN; i++) {
      const k = j * (FN + 1) + i;
      const x = -FE + (2 * FE * i) / FN;
      const z = -FE + (2 * FE * j) / FN;
      fpos.set([x, 0, z], k * 3);
      // nearest wall in a coarse ring search
      let best = { id: -1, d: Infinity };
      for (let rr = 0; rr < 8 && best.id < 0; rr++) {
        const q = nearestWide(x, z, rr);
        if (q.id >= 0) best = q;
      }
      d1[k] = best.d;
      r1[k] = best.id;
      // second wall: across the gap, from the first wall's neighbour data
      if (best.id >= 0) {
        const bb = bands[(best.id / SAMPLES) | 0];
        const s = best.id % SAMPLES;
        const outer = (x - bb.px[s]) * bb.nx[s] + (z - bb.pz[s]) * bb.nz[s] > 0;
        const gap = outer ? bb.dOut[s] : bb.dIn[s];
        d2[k] = Math.max(gap - best.d, 1e-3);
        r2[k] = outer ? bb.hOutRef[s] : bb.hInRef[s];
      } else {
        d2[k] = MAXD;
        r2[k] = -1;
      }
    }
  function nearestWide(x: number, z: number, ring: number) {
    let best = -1;
    let bd = Infinity;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const R = ring + 1;
    for (let dx = -R; dx <= R; dx++)
      for (let dz = -R; dz <= R; dz++) {
        const arr = grid.get((cx + dx + 4096) * 8192 + (cz + dz + 4096));
        if (!arr) continue;
        for (const id of arr) {
          const b = bands[(id / SAMPLES) | 0];
          const s = id % SAMPLES;
          const d = Math.hypot(b.px[s] - x, b.pz[s] - z);
          if (d < bd) { bd = d; best = id; }
        }
      }
    return { id: best, d: bd };
  }
  for (let j = 0; j < FN; j++)
    for (let i = 0; i < FN; i++) {
      const a = j * (FN + 1) + i;
      findex.push(a, a + FN + 1, a + 1, a + 1, a + FN + 1, a + FN + 2);
    }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute("position", new THREE.BufferAttribute(fpos, 3));
  const fn = new Float32Array(fpos.length);
  for (let k = 0; k < fn.length; k += 3) fn[k + 1] = 1;
  floor.setAttribute("normal", new THREE.BufferAttribute(fn, 3));
  floor.setAttribute("color", new THREE.BufferAttribute(fcol, 3));
  floor.setIndex(findex);
  floor.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  return { bands, geometry, floor, floorRefs: { d1, d2, r1, r2 } };
};

/** Height of band b at sample s at loop phase u (whole ripple cycles). */
export const heightAt = (b: Band, s: number, u: number) =>
  HEIGHT * (1 + 0.1 * Math.sin(TAU * (b.ripK * (s / SAMPLES) + u) + b.ripPh));

// Openness of a vertical face at height y, facing a wall of height hn at
// distance d (2D cross-section, cosine-weighted, with a little bounce).
const wallOpen = (y: number, hn: number, d: number) => {
  const alpha = Math.atan2(hn - y, d);
  const sky = (1 - Math.sin(alpha)) / 2; // 0.5 for an open wall above a floor
  return Math.min(1, (sky + 0.4 * (1 - sky)) / 0.7);
};
const floorOpen = (h1: number, d1: number, h2: number, d2: number) => {
  const b1 = Math.atan2(h1, Math.max(d1, 1e-3));
  const b2 = Math.atan2(h2, Math.max(d2, 1e-3));
  const open = 1 - (1 - Math.cos(b1)) / 2 - (1 - Math.cos(b2)) / 2;
  return Math.max(0, open);
};

/** Update wall positions/normals/AO and floor AO for loop phase u. */
export const updateSpiral = (g: SpiralGeom, u: number, aoStrength: number) => {
  const { bands } = g;
  const pos = g.geometry.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.geometry.getAttribute("normal") as THREE.BufferAttribute;
  const col = g.geometry.getAttribute("color") as THREE.BufferAttribute;
  const P = pos.array as Float32Array;
  const N = nor.array as Float32Array;
  const C = col.array as Float32Array;
  const heights = bands.map((b) => {
    const h = new Float32Array(SAMPLES);
    for (let s = 0; s < SAMPLES; s++) h[s] = heightAt(b, s, u);
    return h;
  });
  const hRef = (id: number) => (id < 0 ? 0 : heights[(id / SAMPLES) | 0][id % SAMPLES]);
  const R = THICK / 2;
  const ao = (o: number) => 1 - aoStrength * (1 - o);
  let v = 0;
  for (let bi = 0; bi < BANDS; bi++) {
    const b = bands[bi];
    for (let s = 0; s < SAMPLES; s++) {
      const h = heights[bi][s];
      const straight = h - R;
      const x = b.px[s];
      const z = b.pz[s];
      const ox = b.nx[s];
      const oz = b.nz[s];
      const hOut = hRef(b.hOutRef[s]);
      const hIn = hRef(b.hInRef[s]);
      const put = (px: number, py: number, pz: number, nx: number, ny: number, nz: number, a: number) => {
        P[v * 3] = px; P[v * 3 + 1] = py; P[v * 3 + 2] = pz;
        N[v * 3] = nx; N[v * 3 + 1] = ny; N[v * 3 + 2] = nz;
        C[v * 3] = a; C[v * 3 + 1] = a; C[v * 3 + 2] = a;
        v++;
      };
      // outer side, bottom to top
      for (const f of SIDE_ROWS) {
        const y = straight * f;
        const corner = 1 - 0.32 * Math.exp(-y / 0.025);
        put(x + ox * R, y, z + oz * R, ox, 0, oz, ao(wallOpen(y, hOut, b.dOut[s]) * corner));
      }
      // rounded top
      for (let k = 1; k <= ARC; k++) {
        const a = (k / (ARC + 1)) * Math.PI;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        put(x + ox * R * c, straight + R * sn, z + oz * R * c, ox * c, sn, oz * c, 1);
      }
      // inner side, top to bottom
      for (let k = SIDE_ROWS.length - 1; k >= 0; k--) {
        const y = straight * SIDE_ROWS[k];
        const corner = 1 - 0.32 * Math.exp(-y / 0.025);
        put(x - ox * R, y, z - oz * R, -ox, 0, -oz, ao(wallOpen(y, hIn, b.dIn[s]) * corner));
      }
    }
  }
  // End caps: copies of the first/last profile with the tangent as normal.
  for (let bi = 0; bi < BANDS; bi++) {
    const b = bands[bi];
    for (let e = 0; e < 2; e++) {
      const s = e === 0 ? 0 : SAMPLES - 1;
      const s2 = e === 0 ? 1 : SAMPLES - 2;
      let tx = b.px[s] - b.px[s2];
      let tz = b.pz[s] - b.pz[s2];
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const src = (bi * SAMPLES + s) * PROFILE;
      for (let p = 0; p < PROFILE; p++) {
        const k = src + p;
        P[v * 3] = P[k * 3]; P[v * 3 + 1] = P[k * 3 + 1]; P[v * 3 + 2] = P[k * 3 + 2];
        N[v * 3] = tx; N[v * 3 + 1] = 0; N[v * 3 + 2] = tz;
        C[v * 3] = C[k * 3]; C[v * 3 + 1] = C[k * 3 + 1]; C[v * 3 + 2] = C[k * 3 + 2];
        v++;
      }
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  col.needsUpdate = true;
  const fc = g.floor.getAttribute("color") as THREE.BufferAttribute;
  const F = fc.array as Float32Array;
  const { d1, d2, r1, r2 } = g.floorRefs;
  for (let k = 0; k < d1.length; k++) {
    const a = ao(floorOpen(hRef(r1[k]), d1[k], hRef(r2[k]), d2[k]));
    F[k * 3] = a; F[k * 3 + 1] = a; F[k * 3 + 2] = a;
  }
  fc.needsUpdate = true;
};
