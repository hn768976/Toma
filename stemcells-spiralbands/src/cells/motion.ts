// Closed-path motion helpers: everything is a sum of whole cycles over the
// loop, so frame 0 and frame N are identical.
import * as THREE from "three";
import { range, TAU, type Rng } from "../lib/random";

export type Orbit = {
  amp1: THREE.Vector3;
  ph1: THREE.Vector3;
  amp2: THREE.Vector3;
  ph2: THREE.Vector3;
};

export const makeOrbit = (rng: Rng, a1: number, a2: number): Orbit => ({
  amp1: new THREE.Vector3(range(rng, -a1, a1), range(rng, -a1, a1), range(rng, -a1, a1) * 0.6),
  ph1: new THREE.Vector3(rng() * TAU, rng() * TAU, rng() * TAU),
  amp2: new THREE.Vector3(range(rng, -a2, a2), range(rng, -a2, a2), range(rng, -a2, a2) * 0.6),
  ph2: new THREE.Vector3(rng() * TAU, rng() * TAU, rng() * TAU),
});

/** Offset at loop phase u in [0, 1]. */
export const orbitAt = (o: Orbit, u: number, out: THREE.Vector3) => {
  const t = u * TAU;
  return out.set(
    o.amp1.x * Math.sin(t + o.ph1.x) + o.amp2.x * Math.sin(2 * t + o.ph2.x),
    o.amp1.y * Math.sin(t + o.ph1.y) + o.amp2.y * Math.sin(2 * t + o.ph2.y),
    o.amp1.z * Math.sin(t + o.ph1.z) + o.amp2.z * Math.sin(2 * t + o.ph2.z),
  );
};

export type Spin = { base: THREE.Euler; amp: THREE.Vector3; ph: THREE.Vector3 };

export const makeSpin = (rng: Rng, amp: number): Spin => ({
  base: new THREE.Euler(rng() * TAU, rng() * TAU, rng() * TAU),
  amp: new THREE.Vector3(range(rng, 0.4, 1) * amp, range(rng, 0.4, 1) * amp, range(rng, 0.4, 1) * amp),
  ph: new THREE.Vector3(rng() * TAU, rng() * TAU, rng() * TAU),
});

const eul = new THREE.Euler();
export const spinAt = (s: Spin, u: number, out: THREE.Quaternion) => {
  const t = u * TAU;
  eul.set(
    s.base.x + s.amp.x * Math.sin(t + s.ph.x),
    s.base.y + s.amp.y * Math.sin(t + s.ph.y),
    s.base.z + s.amp.z * Math.sin(t + s.ph.z),
  );
  return out.setFromEuler(eul);
};

export const randomQuat = (rng: Rng) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * TAU, rng() * TAU, rng() * TAU));

export const randomUnit = (rng: Rng) => {
  const z = range(rng, -1, 1);
  const a = rng() * TAU;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z);
};

export const makeParticles = (
  rng: Rng,
  count: number,
  box: { x: number; y: number; z0: number; z1: number },
) => {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const z = range(rng, box.z0, box.z1);
    const spread = Math.abs(z) / Math.abs(box.z1);
    positions[i * 3] = range(rng, -box.x, box.x) * (0.35 + 0.65 * spread);
    positions[i * 3 + 1] = range(rng, -box.y, box.y) * (0.35 + 0.65 * spread);
    positions[i * 3 + 2] = z;
    seeds[i * 4] = rng() * TAU;
    seeds[i * 4 + 1] = rng() * TAU;
    seeds[i * 4 + 2] = rng() * TAU;
    seeds[i * 4 + 3] = range(rng, 0.5, 1.6);
  }
  return { positions, seeds };
};
