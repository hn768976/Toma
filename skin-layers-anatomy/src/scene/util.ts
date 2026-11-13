import * as THREE from "three";

/** Deterministic PRNG (mulberry32) so every render is identical. */
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
/** 0 before `a`, 1 after `b`, linear in between. */
export const ramp = (t: number, a: number, b: number) =>
  clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Tube along a curve whose radius varies with the curve parameter. */
export const taperedTube = (
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radialSegments: number,
  radiusAt: (u: number) => number,
) => {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radiusAt(u);
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const nx = cos * N.x + sin * B.x;
      const ny = cos * N.y + sin * B.y;
      const nz = cos * N.z + sin * B.z;
      positions.push(p.x + r * nx, p.y + r * ny, p.z + r * nz);
      normals.push(nx, ny, nz);
      uvs.push(u, j / radialSegments);
    }
  }
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = (radialSegments + 1) * i + j;
      const b = (radialSegments + 1) * (i + 1) + j;
      const c = (radialSegments + 1) * (i + 1) + j + 1;
      const d = (radialSegments + 1) * i + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return g;
};
