// State helpers for a cell that is not dividing.
import * as THREE from "three";
import type { CellState, FragmentState, NucleusState } from "./types";
import { range, TAU, type Rng } from "../lib/random";
import { randomQuat, randomUnit } from "./motion";

export const NUCLEUS_SCALE = 0.4;

export const makeNucleus = (offset: THREE.Vector3, scale: number, quat: THREE.Quaternion, visible: boolean): NucleusState => ({
  offset: offset.clone(),
  scale,
  stretch: 0,
  quat: quat.clone(),
  visible,
});

export const restCell = (): CellState => ({
  pos: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  radius: 1,
  profile: { d: 0, ra: 1, k: 0 },
  nuclei: [
    makeNucleus(new THREE.Vector3(), NUCLEUS_SCALE, new THREE.Quaternion(), true),
    makeNucleus(new THREE.Vector3(), NUCLEUS_SCALE, new THREE.Quaternion(), false),
  ],
  fragments: [],
  wobPhase: 0,
  visible: true,
});

/** Small red fragments drifting near a cell (Cell Field Red). */
export type FragmentSeed = {
  dir: THREE.Vector3;
  dist: number;
  scale: THREE.Vector3;
  quat: THREE.Quaternion;
  ph: number;
};

export const makeFragmentSeeds = (rng: Rng, n: number): FragmentSeed[] =>
  Array.from({ length: n }, () => {
    // Torn flakes: flat, irregular, close to the membrane.
    const s = range(rng, 0.03, 0.07);
    return {
      dir: randomUnit(rng),
      dist: range(rng, 0.78, 1.08),
      scale: new THREE.Vector3(s * range(rng, 1.0, 1.6), s * range(rng, 0.7, 1.2), s * range(rng, 0.2, 0.35)),
      quat: randomQuat(rng),
      ph: rng() * TAU,
    };
  });

const tmpQ = new THREE.Quaternion();
const axisY = new THREE.Vector3(0, 1, 0);
export const fragmentsAt = (seeds: FragmentSeed[], u: number): FragmentState[] =>
  seeds.map((f) => {
    const wob = 0.06 * Math.sin(u * TAU + f.ph);
    return {
      offset: f.dir.clone().multiplyScalar(f.dist + wob),
      scale: f.scale,
      quat: f.quat.clone().multiply(tmpQ.setFromAxisAngle(axisY, u * TAU + f.ph)),
    };
  });
