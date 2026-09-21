// Build-time particle field.
//
// Every value a particle needs for its whole 600 frames is drawn here, once,
// from a seeded stream. The render path reads this table and computes matrices
// from `frame` alone — it never draws another random number, and never carries
// state from one frame to the next.

import * as THREE from "three";
import { mulberry32, range, intRange, jitter, type Rng } from "./rng";
import { fibonacciSphere, makeSurfaceRadius } from "./geometry";
import type { LookSpec } from "../data/types";

export interface SpikeInstance {
  /** Local transform of the spike within its particle, radius 1. */
  matrix: THREE.Matrix4;
  /** Index into the look's colorways, inherited from the particle. */
  colorway: number;
  /** True when this cap takes the accent colour. */
  accent: boolean;
}

export interface Particle {
  base: THREE.Vector3;
  radius: number;
  colorway: number;
  /** Unit axis the particle spins about. */
  axis: THREE.Vector3;
  /** Whole turns over the composition. Never fractional — that breaks the loop. */
  turns: number;
  /** Starting angle, so particles are not all phase-aligned at frame 0. */
  phase: number;
  /** Lissajous amplitudes, in world units. */
  amp: THREE.Vector3;
  /** Lissajous frequencies. Integers, so the path closes at t = 1. */
  freq: THREE.Vector3;
  /** Lissajous phases. */
  drift: THREE.Vector3;
  spikes: SpikeInstance[];
}

export interface Field {
  particles: Particle[];
  /** Total spike instances across the field, for buffer sizing. */
  spikeTotal: number;
  hero: Particle;
}

/** Half-height of the view frustum at world depth `z`. */
export const frustumHalfHeight = (
  z: number,
  cameraZ: number,
  fovDeg: number,
): number => Math.tan((fovDeg * Math.PI) / 360) * (cameraZ - z);

const buildSpikes = (
  look: LookSpec,
  rng: Rng,
  colorway: number,
): SpikeInstance[] => {
  const n = intRange(rng, look.particles.spikeCount[0], look.particles.spikeCount[1]);
  const dirs = fibonacciSphere(n);
  const surfaceRadius = makeSurfaceRadius({
    displace: look.core.displace,
    displaceFreq: look.core.displaceFreq,
    seed: look.seed,
  });

  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();

  return dirs.map((dir) => {
    // Seat the base slightly inside the displaced surface so no gap shows at
    // the join, whichever way the core dents.
    const r = surfaceRadius(dir) - 0.02 * look.spike.scale;
    pos.copy(dir).multiplyScalar(r);

    // Orient along the surface normal. On a noise-displaced sphere the radial
    // direction is close enough to the normal at these amplitudes.
    quat.setFromUnitVectors(up, dir);

    // Perfectly uniform spikes look manufactured; +/-8% breaks it up.
    const s = 1 + jitter(rng, 0.08);
    const lengthJitter = 1 + jitter(rng, 0.08);
    scale.set(
      look.spike.scale * s,
      look.spike.scale * s * lengthJitter,
      look.spike.scale * s,
    );

    const matrix = new THREE.Matrix4().compose(pos, quat, scale);
    const accent = look.capAccent ? rng() < look.capAccent.fraction : false;
    return { matrix, colorway, accent };
  });
};

const weightedColorway = (look: LookSpec, rng: Rng): number => {
  const weights = look.colorways.map((c) => c.weight ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let t = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    t -= weights[i];
    if (t <= 0) return i;
  }
  return weights.length - 1;
};

export const buildField = (
  look: LookSpec,
  cameraZ: number,
  fovDeg: number,
): Field => {
  const rng = mulberry32(look.seed);
  const { count, radiusRange, depthRange, spread } = look.particles;

  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Walk the depth range in even steps with jitter, so the field fills the
    // whole z span rather than clumping — that even spread is what produces a
    // real sharpness gradient instead of two flat layers.
    const tDepth = (i + range(rng, 0.1, 0.9)) / count;
    const z = depthRange[0] + (depthRange[1] - depthRange[0]) * tDepth;

    // Nearer particles read larger; the radius range still applies at any depth
    // so the field does not look like a single sphere scaled by distance.
    const nearness = (z - depthRange[0]) / (depthRange[1] - depthRange[0]);
    // Biases the field small so only a few particles reach hero size. Squaring
    // the draw overdid it and left every look looking like distant confetti;
    // this exponent keeps the mean at about 0.4 of the range.
    const roll = Math.pow(rng(), 1.45);
    const radius =
      radiusRange[0] +
      (radiusRange[1] - radiusRange[0]) * roll * (0.4 + 0.6 * nearness);

    const halfH = frustumHalfHeight(z, cameraZ, fovDeg) * spread;
    const halfW = halfH * (16 / 9);
    const base = new THREE.Vector3(
      range(rng, -halfW, halfW),
      range(rng, -halfH, halfH),
      z,
    );

    const axis = new THREE.Vector3(
      range(rng, -1, 1),
      range(rng, -1, 1),
      range(rng, -1, 1),
    );
    if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0);
    axis.normalize();

    // Large foreground particles get one turn over the clip; small background
    // ones may take two, which is not perceptibly fast at that size and blur.
    const turns = radius > (radiusRange[0] + radiusRange[1]) / 2 ? 1 : intRange(rng, 1, 2);

    // A slow hover: 10-20% of the particle's own diameter.
    const ampScale = range(rng, 0.1, 0.2) * radius * 2;
    const amp = new THREE.Vector3(
      ampScale * range(rng, 0.7, 1.3),
      ampScale * range(rng, 0.7, 1.3),
      ampScale * range(rng, 0.5, 1.1),
    );
    const freq = new THREE.Vector3(
      intRange(rng, 1, 3),
      intRange(rng, 1, 3),
      intRange(rng, 1, 2),
    );
    const drift = new THREE.Vector3(
      range(rng, 0, Math.PI * 2),
      range(rng, 0, Math.PI * 2),
      range(rng, 0, Math.PI * 2),
    );

    const colorway = weightedColorway(look, rng);

    particles.push({
      base,
      radius,
      colorway,
      axis,
      turns,
      phase: range(rng, 0, Math.PI * 2),
      amp,
      freq,
      drift,
      spikes: buildSpikes(look, rng, colorway),
    });
  }

  // Promote one particle to hero: bigger, placed deliberately, and sitting on
  // the focus plane. Every reference is composed around a dominant subject
  // with the rest supporting it, which an evenly-sampled field never produces.
  const heroIndex = Math.min(look.heroIndex, particles.length - 1);
  const hero = particles[heroIndex];
  hero.radius = radiusRange[1] * look.particles.heroScale;
  const heroHalfH = frustumHalfHeight(look.particles.heroDepth, cameraZ, fovDeg);
  hero.base.set(
    look.particles.heroAt[0] * heroHalfH * (16 / 9),
    look.particles.heroAt[1] * heroHalfH,
    look.particles.heroDepth,
  );
  // A hero this size must not wander far, or it drifts out of its own focus
  // band and the frame loses its anchor.
  hero.amp.multiplyScalar(0.45);
  hero.turns = 1;

  const spikeTotal = particles.reduce((a, p) => a + p.spikes.length, 0);
  return { particles, spikeTotal, hero };
};
