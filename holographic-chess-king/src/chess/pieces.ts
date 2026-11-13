import * as THREE from "three";

// Staunton-style pieces turned on a lathe. Units: one board square = 1.
type Profile = [number, number][];

const lathe = (profile: Profile, segments = 72) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

const baseProfile = (r: number): Profile => [
  [0, 0],
  [r, 0],
  [r, 0.05],
  [r - 0.03, 0.08],
  [r - 0.02, 0.11],
  [r - 0.08, 0.15],
  [r - 0.14, 0.2],
];

const merge = (parts: THREE.BufferGeometry[]) => {
  // Small manual merge (all parts are non-indexed after toNonIndexed()).
  const geoms = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  geoms.forEach((g) => (count += g.attributes.position.count));
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of geoms) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
};

export const kingGeometry = () => {
  const body = lathe([
    ...baseProfile(0.4),
    [0.24, 0.26], [0.2, 0.45], [0.165, 0.7], [0.15, 0.95], [0.15, 1.04],
    [0.22, 1.07], [0.23, 1.11], [0.17, 1.14], [0.2, 1.17], [0.18, 1.21],
    [0.17, 1.25], [0.21, 1.4], [0.25, 1.5], [0.255, 1.53], [0.22, 1.555],
    [0.14, 1.58], [0.09, 1.6], [0, 1.61],
  ]);
  // Rounded (capsule) cross so the rim light outlines both arms.
  const v = new THREE.CapsuleGeometry(0.036, 0.17, 6, 16).translate(0, 1.72, 0);
  const h = new THREE.CapsuleGeometry(0.032, 0.13, 6, 16).rotateZ(Math.PI / 2).translate(0, 1.75, 0);
  return merge([body, v, h]);
};

export const queenGeometry = () => {
  const body = lathe([
    ...baseProfile(0.4),
    [0.22, 0.26], [0.18, 0.45], [0.15, 0.7], [0.14, 0.92], [0.2, 0.95],
    [0.21, 0.99], [0.15, 1.02], [0.17, 1.06], [0.15, 1.1], [0.2, 1.25],
    [0.25, 1.36], [0.22, 1.38], [0.15, 1.4], [0.12, 1.44], [0.08, 1.46], [0, 1.47],
  ]);
  const parts: THREE.BufferGeometry[] = [body];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push(new THREE.SphereGeometry(0.04, 12, 8).translate(Math.cos(a) * 0.235, 1.39, Math.sin(a) * 0.235));
  }
  parts.push(new THREE.SphereGeometry(0.07, 16, 12).translate(0, 1.53, 0));
  return merge(parts);
};

export const bishopGeometry = () => {
  const body = lathe([
    ...baseProfile(0.38),
    [0.21, 0.26], [0.17, 0.45], [0.14, 0.68], [0.13, 0.86], [0.19, 0.89],
    [0.2, 0.93], [0.13, 0.96], [0.17, 1.02], [0.2, 1.12], [0.19, 1.22],
    [0.15, 1.3], [0.08, 1.36], [0, 1.38],
  ]);
  const ball = new THREE.SphereGeometry(0.05, 16, 12).translate(0, 1.42, 0);
  return merge([body, ball]);
};

export const pawnGeometry = () => {
  const body = lathe([
    ...baseProfile(0.36),
    [0.19, 0.24], [0.15, 0.4], [0.12, 0.57], [0.2, 0.6], [0.21, 0.64], [0.13, 0.67], [0, 0.68],
  ]);
  const head = new THREE.SphereGeometry(0.17, 32, 24).translate(0, 0.8, 0);
  return merge([body, head]);
};

export const rookGeometry = () => {
  const body = lathe([
    ...baseProfile(0.4),
    [0.27, 0.24], [0.24, 0.5], [0.22, 0.8], [0.23, 0.88], [0.28, 0.93],
    [0.3, 0.98], [0.3, 1.14], [0.24, 1.14], [0.24, 1.06], [0, 1.06],
  ]);
  const parts: THREE.BufferGeometry[] = [body];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const box = new THREE.BoxGeometry(0.07, 0.09, 0.1);
    box.rotateY(-a);
    box.translate(Math.cos(a) * 0.27, 1.185, Math.sin(a) * 0.27);
    parts.push(box);
  }
  return merge(parts);
};
