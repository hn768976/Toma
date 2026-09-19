import * as THREE from "three";
import { mulberry32, pointInDisc, range, type Rng } from "./rng";

/** Everything downstream of the camera plane; cells recycle inside this slab. */
export const NEAR_PLANE_Z = 4;

export const wrap = (value: number, min: number, max: number) => {
  const span = max - min;
  return min + (((value - min) % span) + span) % span;
};

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export type FlowParticle = {
  /** Normalised position on the unit disc; scaled to the frustum each frame. */
  x: number;
  y: number;
  z0: number;
  size: number;
  /** Euler angles at t = 0 and their angular velocities. */
  rot: [number, number, number];
  spin: [number, number, number];
  /** Lateral wobble frequencies and phases. */
  wobble: [number, number, number, number];
  tint: THREE.Color;
  speed: number;
};

export type FlowFieldOptions = {
  count: number;
  seed: number;
  depth: number;
  size: [number, number];
  tumble: number;
  /** Per-particle speed jitter, 0..1. */
  speedJitter?: number;
  /** Base colour that per-particle tints vary around. */
  color?: string;
  colorSpread?: number;
};

/**
 * Builds the static description of a population of drifting bodies.
 *
 * Only values that never change live here; per-frame positions are derived from
 * these plus the current time, which keeps every frame independent (and so
 * safely renderable out of order, on any number of machines).
 */
export const createFlowField = (options: FlowFieldOptions): FlowParticle[] => {
  const rng: Rng = mulberry32(options.seed);
  const base = new THREE.Color(options.color ?? "#ffffff");
  const colorSpread = options.colorSpread ?? 0;

  return Array.from({ length: options.count }, () => {
    const [x, y] = pointInDisc(rng, 1);
    const tint = base.clone();
    if (colorSpread > 0) {
      const hsl = { h: 0, s: 0, l: 0 };
      tint.getHSL(hsl);
      tint.setHSL(
        (hsl.h + range(rng, -0.012, 0.012) + 1) % 1,
        THREE.MathUtils.clamp(hsl.s + range(rng, -colorSpread * 0.5, colorSpread * 0.25), 0, 1),
        THREE.MathUtils.clamp(hsl.l * (1 + range(rng, -colorSpread, colorSpread)), 0.02, 0.85),
      );
    }

    return {
      x,
      y,
      z0: range(rng, -options.depth, NEAR_PLANE_Z),
      size: range(rng, options.size[0], options.size[1]),
      rot: [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2],
      spin: [
        range(rng, -options.tumble, options.tumble),
        range(rng, -options.tumble, options.tumble),
        range(rng, -options.tumble, options.tumble),
      ],
      wobble: [range(rng, 0.2, 0.7), range(rng, 0.2, 0.7), rng() * Math.PI * 2, rng() * Math.PI * 2],
      tint,
      speed: 1 + (options.speedJitter ?? 0) * range(rng, -1, 1),
    } satisfies FlowParticle;
  });
};

/**
 * Radius of the camera frustum at a given depth.
 *
 * Particles are placed on a unit disc and scaled by this each frame, so the
 * population fills the frame evenly at every distance. Distributing them in a
 * fixed-radius cylinder instead — the obvious way — puts most near-camera cells
 * outside the lens and leaves the centre of frame sparse.
 */
export const frustumRadius = (
  z: number,
  fovDegrees: number,
  aspect: number,
  fill: number,
  minDistance: number,
) => {
  // Clamping the distance turns the cone into a cylinder near the lens. Without
  // it the cone converges on the camera and a single cell swallows the frame;
  // with it, close cells hold their spacing and sweep out past the frame edges
  // the way they do in the references.
  const distance = Math.max(minDistance, Math.abs(z));
  const halfHeight = distance * Math.tan((fovDegrees * Math.PI) / 360);
  return halfHeight * Math.max(1, aspect) * fill;
};

/**
 * Current Z of a particle, recycled into the far end of the slab once it has
 * passed the camera.
 */
export const flowZ = (particle: FlowParticle, time: number, speed: number, depth: number) =>
  wrap(particle.z0 + time * speed * particle.speed, -depth, NEAR_PLANE_Z);

/**
 * Fades a particle in as it appears at the far end so recycling never pops,
 * and back out as it reaches the camera plane.
 */
export const flowFade = (z: number, depth: number) =>
  smoothstep(-depth, -depth * 0.82, z) * (1 - smoothstep(NEAR_PLANE_Z - 2.5, NEAR_PLANE_Z, z));

export const wobbleOffset = (particle: FlowParticle, time: number, amount: number) => {
  if (amount === 0) {
    return [0, 0] as const;
  }
  const [fx, fy, px, py] = particle.wobble;
  return [
    Math.sin(time * fx + px) * amount * 0.5,
    Math.cos(time * fy + py) * amount * 0.5,
  ] as const;
};
