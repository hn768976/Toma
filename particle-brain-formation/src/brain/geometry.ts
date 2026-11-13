import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createNoise3D, mulberry32, smoothstep } from "../lib/random";

// Procedural human brain built from signed-distance ellipsoids.
// Axes: -X anterior (frontal lobe), +X posterior, +Y up, +Z = left side.

type Sdf = (x: number, y: number, z: number) => number;

const sdEllipsoid = (
  x: number, y: number, z: number,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
) => {
  const px = x - cx, py = y - cy, pz = z - cz;
  const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
  if (k1 === 0) return -Math.min(rx, ry, rz);
  return (k0 * (k0 - 1)) / k1;
};

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

const hemisphereSdf = (side: 1 | -1): Sdf => (x, y, z) => {
  const zl = z * side; // lateral distance, positive away from the midline
  let d = sdEllipsoid(x, y, zl, 0.04, 0.12, 0.4, 1.0, 0.64, 0.44);
  d = smin(d, sdEllipsoid(x, y, zl, -0.48, 0.02, 0.38, 0.52, 0.55, 0.4), 0.32); // frontal
  d = smin(d, sdEllipsoid(x, y, zl, 0.6, 0.0, 0.34, 0.46, 0.5, 0.34), 0.32); // occipital
  d = smin(d, sdEllipsoid(x, y, zl, 0.16, 0.3, 0.38, 0.64, 0.46, 0.4), 0.3); // parietal crown
  // Temporal lobe — small blend radius keeps the Sylvian fissure crease.
  const temporal = sdEllipsoid(x, y, zl, -0.04, -0.3, 0.47, 0.57, 0.26, 0.31);
  d = smin(d, temporal, 0.07);
  d = Math.max(d, -(y + 0.58)); // flattish base
  // Orbital (under-frontal) surface sits higher than the temporal lobe.
  d = Math.max(d, -(y + 0.2) - 0.9 * Math.max(0, x + 0.62) - 0.3 * Math.max(0, -zl + 0.25));
  d = Math.max(d, 0.025 - zl); // flat medial wall + longitudinal fissure
  return d;
};

const cerebellumSdf: Sdf = (x, y, z) => {
  const a = sdEllipsoid(x, y, z, 0.55, -0.42, 0.21, 0.36, 0.22, 0.28);
  const b = sdEllipsoid(x, y, z, 0.55, -0.42, -0.21, 0.36, 0.22, 0.28);
  return smin(a, b, 0.15);
};

const projectToSdf = (
  geo: THREE.BufferGeometry,
  center: [number, number, number],
  sdf: Sdf,
  rMax: number,
) => {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const [cx, cy, cz] = center;
  const steps = 160;
  for (let i = 0; i < pos.count; i++) {
    let dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);
    const l = Math.hypot(dx, dy, dz);
    dx /= l; dy /= l; dz /= l;
    // Outermost crossing along the ray.
    let lastInside = 0;
    for (let s = 1; s <= steps; s++) {
      const r = (s / steps) * rMax;
      if (sdf(cx + dx * r, cy + dy * r, cz + dz * r) < 0) lastInside = r;
    }
    let lo = lastInside, hi = lastInside + rMax / steps;
    for (let k = 0; k < 22; k++) {
      const m = (lo + hi) / 2;
      if (sdf(cx + dx * m, cy + dy * m, cz + dz * m) < 0) lo = m;
      else hi = m;
    }
    const r = (lo + hi) / 2;
    pos.setXYZ(i, cx + dx * r, cy + dy * r, cz + dz * r);
  }
};

const sdfNormal = (sdf: Sdf, x: number, y: number, z: number): [number, number, number] => {
  const e = 0.003;
  const nx = sdf(x + e, y, z) - sdf(x - e, y, z);
  const ny = sdf(x, y + e, z) - sdf(x, y - e, z);
  const nz = sdf(x, y, z + e) - sdf(x, y, z - e);
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
};

type FoldStyle = { freq: number; depth: number; width: number; seed: number; striated?: boolean };

/** Displace along the SDF normal to carve gyri/sulci; stores per-vertex groove. */
const carveFolds = (geo: THREE.BufferGeometry, sdf: Sdf, style: FoldStyle) => {
  const noise = createNoise3D(style.seed);
  const warp = createNoise3D(style.seed + 101);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const groove = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const [nx, ny, nz] = sdfNormal(sdf, x, y, z);
    let g: number;
    if (style.striated) {
      // Cerebellar folia: fine, roughly horizontal ridges.
      const v = Math.sin((y + 0.06 * warp(x * 4, y * 4, z * 4)) * style.freq);
      g = 1 - smoothstep(0, style.width, Math.abs(v));
    } else {
      const f = style.freq;
      const wx = x * f + 0.55 * warp(x * 1.6, y * 1.6, z * 1.6);
      const wy = y * f + 0.55 * warp(x * 1.6 + 7.3, y * 1.6, z * 1.6);
      const wz = z * f + 0.55 * warp(x * 1.6, y * 1.6 + 3.1, z * 1.6);
      const n = noise(wx, wy, wz);
      g = 1 - smoothstep(0, style.width, Math.abs(n));
    }
    let disp: number;
    if (style.striated) {
      disp = -style.depth * g;
    } else {
      // Rounded gyri with narrow, deep sulci.
      const n = 1 - g; // 0 in the sulcus, 1 on the crown
      disp = -style.depth * (1 - Math.sqrt(n));
    }
    pos.setXYZ(i, x + nx * disp, y + ny * disp, z + nz * disp);
    groove[i] = g;
  }
  geo.setAttribute("aGroove", new THREE.BufferAttribute(groove, 1));
};

const icosphere = (detail: number) => {
  const g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  return mergeVertices(g);
};

const buildBrainstem = (radial: number, rings: number) => {
  // Tapered tube from under the cerebrum down and slightly back.
  const g = new THREE.CylinderGeometry(0.075, 0.115, 0.72, radial, rings, true);
  g.deleteAttribute("uv");
  g.rotateZ(-0.22);
  g.translate(0.02, -0.66, 0);
  g.setAttribute("aGroove", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
  return g;
};

const buildParts = (detail: number, cerebDetail: number, stemSeg: [number, number]) => {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [1, -1] as const) {
    const sdf = hemisphereSdf(side);
    const g = icosphere(detail);
    projectToSdf(g, [0.02, 0.06, 0.42 * side], sdf, 1.4);
    carveFolds(g, sdf, { freq: 2.7, depth: 0.08, width: 0.34, seed: 7 + (side > 0 ? 0 : 50) });
    g.computeVertexNormals();
    parts.push(g);
  }
  const cb = icosphere(cerebDetail);
  projectToSdf(cb, [0.55, -0.42, 0], cerebellumSdf, 0.8);
  carveFolds(cb, cerebellumSdf, { freq: 70, depth: 0.018, width: 0.35, seed: 3, striated: true });
  cb.computeVertexNormals();
  parts.push(cb);
  const stem = buildBrainstem(stemSeg[0], stemSeg[1]);
  stem.computeVertexNormals();
  parts.push(stem);
  return parts;
};

const triangleAreas = (geo: THREE.BufferGeometry) => {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const idx = geo.index!;
  const tris = idx.count / 3;
  const cum = new Float64Array(tris);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, idx.getX(t * 3));
    b.fromBufferAttribute(pos, idx.getX(t * 3 + 1));
    c.fromBufferAttribute(pos, idx.getX(t * 3 + 2));
    total += b.sub(a).cross(c.sub(a)).length() * 0.5;
    cum[t] = total;
  }
  return { cum, total };
};

export type BrainData = {
  points: THREE.BufferGeometry;
  lines: THREE.BufferGeometry;
  /** Solid surface used only to write depth so hidden far-side particles are occluded. */
  occluder: THREE.BufferGeometry;
};

export const buildBrain = (pointCount: number): BrainData => {
  const rand = mulberry32(20261113);
  const fine = buildParts(72, 40, [56, 40]);
  const areas = fine.map((g) => (g.index ? triangleAreas(g) : null));
  // Brainstem is non-indexed-safe: ensure index exists.
  fine.forEach((g, i) => {
    if (!g.index) {
      const merged = mergeVertices(g);
      fine[i] = merged;
      areas[i] = triangleAreas(merged);
    }
  });
  const totalArea = areas.reduce((s, a) => s + a!.total, 0);

  const P = new Float32Array(pointCount * 3);
  const N = new Float32Array(pointCount * 3);
  const R = new Float32Array(pointCount * 3);
  const G = new Float32Array(pointCount);
  let o = 0;
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  fine.forEach((geo, gi) => {
    const { cum, total } = areas[gi]!;
    const count = gi === fine.length - 1
      ? pointCount - o
      : Math.round((pointCount * total) / totalArea);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const nor = geo.attributes.normal as THREE.BufferAttribute;
    const gr = geo.attributes.aGroove as THREE.BufferAttribute;
    const idx = geo.index!;
    for (let k = 0; k < count && o < pointCount; k++, o++) {
      const target = rand() * total;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cum[m] < target) lo = m + 1;
        else hi = m;
      }
      const i0 = idx.getX(lo * 3), i1 = idx.getX(lo * 3 + 1), i2 = idx.getX(lo * 3 + 2);
      let u = rand(), v = rand();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const w = 1 - u - v;
      va.fromBufferAttribute(pos, i0); vb.fromBufferAttribute(pos, i1); vc.fromBufferAttribute(pos, i2);
      na.fromBufferAttribute(nor, i0); nb.fromBufferAttribute(nor, i1); nc.fromBufferAttribute(nor, i2);
      P[o * 3] = va.x * w + vb.x * u + vc.x * v;
      P[o * 3 + 1] = va.y * w + vb.y * u + vc.y * v;
      P[o * 3 + 2] = va.z * w + vb.z * u + vc.z * v;
      const nx = na.x * w + nb.x * u + nc.x * v;
      const ny = na.y * w + nb.y * u + nc.y * v;
      const nz = na.z * w + nb.z * u + nc.z * v;
      const nl = Math.hypot(nx, ny, nz) || 1;
      N[o * 3] = nx / nl; N[o * 3 + 1] = ny / nl; N[o * 3 + 2] = nz / nl;
      G[o] = gr.getX(i0) * w + gr.getX(i1) * u + gr.getX(i2) * v;
      R[o * 3] = rand(); R[o * 3 + 1] = rand(); R[o * 3 + 2] = rand();
    }
  });
  const points = new THREE.BufferGeometry();
  points.setAttribute("position", new THREE.BufferAttribute(P, 3));
  points.setAttribute("aNormal", new THREE.BufferAttribute(N, 3));
  points.setAttribute("aRand", new THREE.BufferAttribute(R, 3));
  points.setAttribute("aGroove", new THREE.BufferAttribute(G, 1));
  points.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

  // Coarser net for the visible wire mesh.
  const coarse = buildParts(26, 14, [20, 14]);
  const segPos: number[] = [];
  const segNor: number[] = [];
  for (const g0 of coarse.slice(0, -1)) {
    const g = g0.index ? g0 : mergeVertices(g0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const idx = g.index!;
    const seen = new Set<number>();
    const push = (a: number, b: number) => {
      const key = a < b ? a * 1e6 + b : b * 1e6 + a;
      if (seen.has(key)) return;
      seen.add(key);
      for (const i of [a, b]) {
        segPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        segNor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      }
    };
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      push(a, b); push(b, c); push(c, a);
    }
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.Float32BufferAttribute(segPos, 3));
  lines.setAttribute("aNormal", new THREE.Float32BufferAttribute(segNor, 3));
  lines.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

  const occluder = mergeGeometries(
    fine.map((g) => {
      const c = new THREE.BufferGeometry();
      c.setIndex(g.index!.clone());
      c.setAttribute("position", g.attributes.position.clone());
      c.setAttribute("aNormal", g.attributes.normal.clone());
      c.setAttribute("aGroove", g.attributes.aGroove.clone());
      return c;
    }),
  );
  occluder.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

  [...fine, ...coarse].forEach((g) => g.dispose());
  return { points, lines, occluder };
};
