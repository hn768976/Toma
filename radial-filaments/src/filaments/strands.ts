import * as THREE from "three";

// Small deterministic PRNG so every render builds identical geometry.
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type StrandOptions = {
  longStrands: number; // strands radiating from the core to the rim
  shortStrands: number; // short tangled strands around the core
  segments: number;
  rimRadius: number;
};

/**
 * Builds one indexed ribbon mesh holding every strand. The geometry only
 * carries per-strand constants; positions are computed in the vertex shader.
 */
export const buildStrandGeometry = ({
  longStrands,
  shortStrands,
  segments,
  rimRadius,
}: StrandOptions) => {
  const rand = mulberry32(1337);
  const total = longStrands + shortStrands;
  const vertsPerStrand = (segments + 1) * 2;
  const strand = new Float32Array(total * vertsPerStrand * 4);
  const param = new Float32Array(total * vertsPerStrand * 2);
  const index = new Uint32Array(total * segments * 6);

  let v = 0;
  let k = 0;
  for (let s = 0; s < total; s++) {
    const isLong = s < longStrands;
    const angle = isLong
      ? ((s + rand() * 0.8) / longStrands) * Math.PI * 2
      : rand() * Math.PI * 2;
    const seed = rand() * 1000;
    const start = isLong ? rand() * rand() * 0.9 : rand() * 0.5;
    const end = isLong
      ? rimRadius * (0.55 + 0.45 * Math.sqrt(rand()))
      : start + 0.6 + rand() * 1.6;

    const base = v;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      for (const side of [-1, 1]) {
        strand.set([angle, seed, start, end], v * 4);
        param.set([t, side], v * 2);
        v++;
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2;
      index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k);
      k += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("aStrand", new THREE.BufferAttribute(strand, 4));
  geometry.setAttribute("aParam", new THREE.BufferAttribute(param, 2));
  // `position` is required by three.js even though the shader ignores it.
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(v * 3), 3),
  );
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(),
    rimRadius * 2,
  );
  return geometry;
};
