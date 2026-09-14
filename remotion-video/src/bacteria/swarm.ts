import * as THREE from "three";
import { mulberry32, range } from "./rng";
import type { LayerSpec } from "./presets";

export type Instance = {
  base: THREE.Vector3;
  /** Resting orientation of the rod. */
  quaternion: THREE.Quaternion;
  /** Axis the cell tumbles about, and how fast. */
  spinAxis: THREE.Vector3;
  spinRate: number;
  /**
   * Drift is a bounded Lissajous rather than a straight line: the swarm
   * keeps flowing for the whole clip without any instance having to be
   * wrapped back across the frame edge.
   */
  driftAmp: THREE.Vector3;
  driftPeriod: THREE.Vector3;
  driftPhase: THREE.Vector3;
  scale: number;
  seed: number;
  shade: number;
};

/**
 * Lays out one depth slice. Deterministic from (seed, layerIndex), so
 * the colour pass and the matte pass place every cell identically and
 * the matte keys the colour frame for frame.
 */
export const buildLayer = (
  spec: LayerSpec,
  seed: number,
  layerIndex: number,
): Instance[] => {
  const rng = mulberry32(seed * 7919 + layerIndex * 104729);
  const instances: Instance[] = [];

  for (let i = 0; i < spec.count; i++) {
    // `clustering` biases placement toward frame centre; raising the
    // unit sample to a power pulls the distribution inward without
    // leaving a hard-edged disc.
    const bias = 1 + spec.clustering * 2.2;
    const rx = Math.sign(rng() - 0.5) * Math.pow(rng(), bias);
    const ry = Math.sign(rng() - 0.5) * Math.pow(rng(), bias);

    const base = new THREE.Vector3(
      rx * spec.spreadX,
      ry * spec.spreadY,
      range(rng, spec.depth[0], spec.depth[1]),
    );

    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        range(rng, -Math.PI, Math.PI),
        range(rng, -Math.PI, Math.PI),
        range(rng, -Math.PI, Math.PI),
      ),
    );

    const spinAxis = new THREE.Vector3(
      range(rng, -1, 1),
      range(rng, -1, 1),
      range(rng, -1, 1),
    ).normalize();

    const amp = spec.drift * 3.4;
    instances.push({
      base,
      quaternion,
      spinAxis,
      spinRate: spec.spin * range(rng, 0.55, 1.5),
      driftAmp: new THREE.Vector3(
        amp * range(rng, 0.6, 1.5),
        amp * range(rng, 0.4, 1.1),
        amp * range(rng, 0.2, 0.7),
      ),
      driftPeriod: new THREE.Vector3(
        range(rng, 9, 19),
        range(rng, 11, 23),
        range(rng, 13, 27),
      ),
      driftPhase: new THREE.Vector3(
        range(rng, 0, Math.PI * 2),
        range(rng, 0, Math.PI * 2),
        range(rng, 0, Math.PI * 2),
      ),
      scale: range(rng, spec.scale[0], spec.scale[1]),
      seed: rng(),
      shade: range(rng, 0.82, 1.18),
    });
  }

  return instances;
};

const scratchPosition = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchSpin = new THREE.Quaternion();
const scratchScale = new THREE.Vector3();

/** Writes the transform of one instance at time `seconds` into `target`. */
export const instanceMatrixAt = (
  instance: Instance,
  seconds: number,
  target: THREE.Matrix4,
) => {
  const tau = Math.PI * 2;
  scratchPosition.set(
    instance.base.x +
      instance.driftAmp.x *
        Math.sin((tau * seconds) / instance.driftPeriod.x + instance.driftPhase.x),
    instance.base.y +
      instance.driftAmp.y *
        Math.sin((tau * seconds) / instance.driftPeriod.y + instance.driftPhase.y),
    instance.base.z +
      instance.driftAmp.z *
        Math.sin((tau * seconds) / instance.driftPeriod.z + instance.driftPhase.z),
  );

  scratchSpin.setFromAxisAngle(instance.spinAxis, instance.spinRate * seconds);
  scratchQuaternion.copy(instance.quaternion).premultiply(scratchSpin);
  scratchScale.setScalar(instance.scale);

  target.compose(scratchPosition, scratchQuaternion, scratchScale);
};

export type Sphere = {
  base: THREE.Vector3;
  radius: number;
  driftAmp: THREE.Vector3;
  driftPeriod: THREE.Vector3;
  driftPhase: THREE.Vector3;
};

/** The loose cocci/vesicles a few of the references scatter through frame. */
export const buildSpheres = (
  count: number,
  size: [number, number],
  seed: number,
): Sphere[] => {
  const rng = mulberry32(seed * 31 + 977);
  const spheres: Sphere[] = [];
  for (let i = 0; i < count; i++) {
    spheres.push({
      base: new THREE.Vector3(
        range(rng, -5, 5),
        range(rng, -3, 3),
        range(rng, -7, 0.5),
      ),
      radius: range(rng, size[0], size[1]),
      driftAmp: new THREE.Vector3(range(rng, 0.2, 0.7), range(rng, 0.2, 0.6), 0.2),
      driftPeriod: new THREE.Vector3(
        range(rng, 10, 20),
        range(rng, 12, 24),
        range(rng, 14, 26),
      ),
      driftPhase: new THREE.Vector3(
        range(rng, 0, Math.PI * 2),
        range(rng, 0, Math.PI * 2),
        range(rng, 0, Math.PI * 2),
      ),
    });
  }
  return spheres;
};
