import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../../lib/random";

// Stylised, featureless mannequin in a neutral standing pose (arms slightly
// away from the body). Smooth tapered lathe pieces, built once.
const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

// Tapered limb from a to b; radii are sampled evenly along the length.
const limb = (a: THREE.Vector3, b: THREE.Vector3, radii: number[], sz = 1) => {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const prof: THREE.Vector2[] = [new THREE.Vector2(0.0001, -radii[0] * 0.6)];
  const S = 9;
  for (let i = 0; i < S; i++) {
    const u = (i / (S - 1)) * (radii.length - 1);
    const i0 = Math.floor(u);
    const r = radii[i0] + (radii[Math.min(radii.length - 1, i0 + 1)] - radii[i0]) * (u - i0);
    prof.push(new THREE.Vector2(r, (i / (S - 1)) * len));
  }
  prof.push(new THREE.Vector2(0.0001, len + radii[radii.length - 1] * 0.6));
  const g = new THREE.LatheGeometry(prof, 18);
  g.scale(1, 1, sz);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
};
const ellipsoid = (c: THREE.Vector3, rx: number, ry: number, rz: number) => {
  const g = new THREE.SphereGeometry(1, 20, 14);
  g.scale(rx, ry, rz);
  g.translate(c.x, c.y, c.z);
  return g;
};

export const buildMannequin = (): THREE.BufferGeometry => {
  const parts: THREE.BufferGeometry[] = [];
  // head (no face) + neck
  parts.push(ellipsoid(v(0, 1.665), 0.08, 0.105, 0.092));
  parts.push(limb(v(0, 1.46), v(0, 1.6), [0.05, 0.045, 0.045]));
  // torso: one smooth lathe from crotch to base of neck
  const torso = new THREE.LatheGeometry(
    [
      [0.0001, 0.86], [0.1, 0.87], [0.15, 0.92], [0.16, 0.98], [0.145, 1.05], [0.125, 1.12], [0.135, 1.2],
      [0.155, 1.28], [0.16, 1.35], [0.165, 1.41], [0.12, 1.46], [0.06, 1.49], [0.0001, 1.5],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    26,
  );
  torso.scale(1.06, 1, 0.62);
  parts.push(torso);
  for (const s of [-1, 1]) {
    // shoulder cap + arm ~25 degrees out from the body
    parts.push(ellipsoid(v(s * 0.18, 1.405), 0.055, 0.046, 0.05));
    parts.push(limb(v(s * 0.19, 1.41), v(s * 0.31, 1.17, -0.01), [0.044, 0.04, 0.035]));
    parts.push(limb(v(s * 0.31, 1.17, -0.01), v(s * 0.42, 0.95, 0.02), [0.034, 0.031, 0.024]));
    parts.push(ellipsoid(v(s * 0.445, 0.89, 0.025), 0.022, 0.05, 0.015));
    // leg
    parts.push(limb(v(s * 0.085, 0.94), v(s * 0.1, 0.5, 0.01), [0.082, 0.08, 0.068, 0.054], 1.05));
    parts.push(limb(v(s * 0.1, 0.5, 0.01), v(s * 0.11, 0.08), [0.05, 0.054, 0.042, 0.032]));
    parts.push(limb(v(s * 0.11, 0.045, -0.03), v(s * 0.12, 0.035, 0.15), [0.032, 0.034, 0.028], 0.7));
  }
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => {
    p.deleteAttribute("uv");
    return p;
  }), false)!;
  merged.computeVertexNormals();
  return merged;
};

const rng = mulberry32(3679902987);

export type FigureSpec = { x: number; z: number; spin: number; phase: number; cycles: number; hud: number };
// x, z, base facing (radians; PI = back view), HUD tag kind (-1 = none)
export const FIGURES: FigureSpec[] = [
  [-3.3, -0.3, 1.2, 0],
  [-1.55, 1.05, Math.PI + 0.3, 1],
  [0.1, 0.0, 0.05, 2],
  [1.45, -1.2, -0.5, 3],
  [2.75, 0.4, Math.PI - 0.6, 4],
  [-2.7, -5.6, 0.4, 5],
  [-0.9, -6.6, Math.PI, -1],
  [2.4, -7.4, -0.3, 6],
  [0.9, -9.5, 0.2, -1],
].map(([x, z, spin, hud]) => ({ x, z, spin, phase: rng() * Math.PI * 2, cycles: rng() < 0.5 ? 1 : 2, hud }));

// Plexus floor: seeded points + neighbour links, generated once.
export const buildPlexus = () => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 520; i++) {
    let x = (rng() * 2 - 1) * 9;
    let z = -11 + rng() * 15;
    if (i % 2 === 0) {
      // cluster around a figure
      const f = FIGURES[Math.floor(rng() * 5)];
      const a = rng() * Math.PI * 2;
      const rr = 0.3 + rng() * 1.6;
      x = f.x + Math.cos(a) * rr;
      z = f.z + Math.sin(a) * rr;
    }
    let y = 0.005;
    // some points lift up around the figures (the "rising" plexus)
    let near = Infinity;
    for (const f of FIGURES) near = Math.min(near, Math.hypot(x - f.x, z - f.z));
    if (near < 1.8 && rng() < 0.45) y = rng() * 1.1 * (1 - near / 1.8);
    pts.push(new THREE.Vector3(x, y, z));
  }
  // tall plexus structure rising on the right
  for (let i = 0; i < 46; i++) {
    pts.push(new THREE.Vector3(4.0 + rng() * 2.2, rng() * rng() * 1.9, -0.6 + rng() * 2.4));
  }
  const seg: number[] = [];
  const bright: number[] = [];
  const alt: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const cand: [number, number][] = [];
    for (let j = i + 1; j < pts.length; j++) {
      const d = pts[i].distanceTo(pts[j]);
      if (d < 1.05) cand.push([d, j]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, j] of cand.slice(0, 3)) {
      seg.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
      const mx = (pts[i].x + pts[j].x) / 2;
      const mz = (pts[i].z + pts[j].z) / 2;
      let near = Infinity;
      for (const f of FIGURES) near = Math.min(near, Math.hypot(mx - f.x, mz - f.z));
      let b = 0.05 + 1.1 * Math.exp(-(near * near) / 0.9);
      if (mx > 3.8) b = Math.max(b, 0.9);
      const a = rng() < 0.12 ? 1 : 0;
      const ph = rng();
      bright.push(b, b);
      alt.push(a + ph * 0.5, a + ph * 0.5);
    }
  }
  return { pts, seg: new Float32Array(seg), bright: new Float32Array(bright), alt: new Float32Array(alt) };
};

// Background bokeh: a few big soft lights, mostly near the top corners.
export const BOKEH = [
  { x: -15.5, y: 3.6, z: -20, s: 6.5, c: 0, a: 1.1 },
  { x: 5.6, y: 4.2, z: -21, s: 2.8, c: 1, a: 1.8 },
  { x: 5.6, y: 4.2, z: -20.9, s: 1.1, c: 1, a: 1.6 },
  { x: -4, y: 5.5, z: -24, s: 5, c: 0, a: 0.05 },
].map((b) => ({ ...b, ph: rng() }));

// Blurred light panels in the far background.
export const PANELS_BG = [
  { x: -6, y: 4.6, z: -18, w: 3.5, h: 0.8, a: 0.06, c: 0 },
  { x: 11, y: 1.5, z: -16, w: 8, h: 2.6, a: 0.16, c: 1 },
  { x: 2, y: 4.0, z: -20, w: 2.2, h: 3, a: 0.05, c: 0 },
  { x: -12, y: 2.4, z: -15, w: 3, h: 1.5, a: 0.05, c: 0 },
  { x: 6, y: 5.5, z: -19, w: 9, h: 4, a: 0.05, c: 1 },
];

// Floating dust specks.
export const DUST = Array.from({ length: 140 }, () => [(rng() * 2 - 1) * 8, 0.2 + rng() * 3.5, -9 + rng() * 11, rng()] as const);
