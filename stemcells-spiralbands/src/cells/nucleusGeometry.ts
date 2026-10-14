// Granular nucleus: an icosphere displaced by fractal noise (lumps) plus two
// octaves of cellular domes (small round bumps). Built once per variant and
// cached; a "cav" attribute (0 = crevice, 1 = peak) drives shading.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeCellular3, makeSimplex3 } from "../lib/noise";

export type NucleusStyle = {
  lump: number; // fbm amplitude (cauliflower lobes)
  lumpFreq: number;
  bump: number; // cellular dome amplitude
  bumpFreq: number;
  fine: number; // second, finer dome octave
};

const cache = new Map<string, THREE.BufferGeometry>();

export const getNucleusGeometry = (
  seed: number,
  detail: number,
  style: NucleusStyle,
): THREE.BufferGeometry => {
  const key = `${seed}:${detail}:${JSON.stringify(style)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-5);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const n3 = makeSimplex3(seed);
  const c1 = makeCellular3(seed + 11);
  const c2 = makeCellular3(seed + 29);
  const disp = new Float32Array(pos.count);
  let lo = Infinity;
  let hi = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const f = style.lumpFreq;
    const fbm =
      n3(v.x * f, v.y * f, v.z * f) * 0.6 +
      n3(v.x * f * 2.1 + 5.2, v.y * f * 2.1, v.z * f * 2.1) * 0.3 +
      n3(v.x * f * 4.3, v.y * f * 4.3 + 1.7, v.z * f * 4.3) * 0.15;
    const b = style.bumpFreq;
    const dome = c1(v.x * b, v.y * b, v.z * b);
    const dome2 = c2(v.x * b * 2.3, v.y * b * 2.3, v.z * b * 2.3);
    // Round tops: sqrt-shaped profile of the dome.
    const d =
      style.lump * fbm +
      style.bump * Math.sqrt(Math.max(0, dome)) +
      style.fine * Math.sqrt(Math.max(0, dome2));
    disp[i] = d;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  // Normalise so the mean radius is ~1.
  const mid = (lo + hi) * 0.5;
  const cav = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const r = 1 + disp[i] - mid;
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    cav[i] = (disp[i] - lo) / Math.max(1e-6, hi - lo);
  }
  g.setAttribute("cav", new THREE.BufferAttribute(cav, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  cache.set(key, g);
  return g;
};
