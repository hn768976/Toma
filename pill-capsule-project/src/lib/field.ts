import * as THREE from "three";
import { mulberry32, range } from "./random";
import { CAPLET_DEPTH, CAPSULE_LENGTH } from "./pill-geometry";

export type PillShape = "capsule" | "tablet" | "caplet";

export type FieldConfig = {
  seed: number;
  /** Shapes to draw from, with relative weights. */
  shapes: { shape: PillShape; weight: number }[];
  /** Number of distinct pills before vertical tiling. */
  count: number;
  /** Vertical period of the field, in world units. The field translates by
   *  exactly this over the composition, which is what makes the loop close. */
  period: number;
  /** Nearest and farthest pill Z. */
  zNear: number;
  zFar: number;
  /** Half-width of the horizontal spread, in world units. */
  halfWidth: number;
  /** Base pill scale (pill units -> world). */
  scale: number;
  /** Deterministic size variation, as a fraction. */
  sizeJitter: number;
  /** Integer turn counts a pill may take over one loop. */
  turnCounts: number[];
  camera: { z: number; fovDeg: number; aspect: number };
};

export type FieldInstance = {
  shape: PillShape;
  /** World position at frame 0, before the loop translation. */
  x: number;
  y: number;
  z: number;
  scale: number;
  /** Rest orientation, before the spin. */
  baseQuat: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  /** Integer number of full turns over one loop. */
  turns: number;
};

/**
 * Builds the falling field.
 *
 * The loop works by vertical periodicity, not by wrapping pills. Every pill is
 * repeated at y + k * period for a range of k wide enough that the outermost
 * copies are off-screen for the whole loop, with one spare tile at each end.
 * The whole field then translates down by exactly `period` over the
 * composition, so at the last frame every pill sits where its own next copy
 * sat at frame 0. Nothing pops; the frames are identical.
 *
 * The spare tile at each end is what makes it exact rather than nearly exact:
 * after the shift the top tile has no successor and the bottom has gained one,
 * and both of those have to be safely outside the frame.
 *
 * Everything here is drawn once from a seeded PRNG at build time. Nothing in
 * this file runs per frame.
 */
export const buildField = (cfg: FieldConfig): FieldInstance[] => {
  const rnd = mulberry32(cfg.seed);
  const totalWeight = cfg.shapes.reduce((s, x) => s + x.weight, 0);

  const base: FieldInstance[] = [];
  for (let i = 0; i < cfg.count; i++) {
    // Draw in a fixed order so adding a shape to the table does not reshuffle
    // the pills that were already there.
    const shapeRoll = rnd() * totalWeight;
    let acc = 0;
    let shape: PillShape = cfg.shapes[0].shape;
    for (const s of cfg.shapes) {
      acc += s.weight;
      if (shapeRoll < acc) {
        shape = s.shape;
        break;
      }
    }

    // Stratify Y so the field stays evenly spread rather than clumping.
    const y = ((i + rnd()) / cfg.count) * cfg.period;
    const z = range(rnd, cfg.zFar, cfg.zNear);
    // Spread X proportionally to depth, so the far plane stays filled.
    const widthAtZ = cfg.halfWidth * ((cfg.camera.z - z) / (cfg.camera.z - cfg.zNear));
    const x = range(rnd, -widthAtZ, widthAtZ);

    const scale = cfg.scale * (1 + range(rnd, -cfg.sizeJitter, cfg.sizeJitter));

    const baseQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        range(rnd, -Math.PI, Math.PI),
        range(rnd, -Math.PI, Math.PI),
        range(rnd, -Math.PI, Math.PI),
      ),
    );
    const spinAxis = new THREE.Vector3(
      range(rnd, -1, 1),
      range(rnd, -1, 1),
      range(rnd, -1, 1),
    );
    if (spinAxis.lengthSq() < 1e-6) spinAxis.set(0, 1, 0);
    spinAxis.normalize();

    const turns =
      cfg.turnCounts[Math.min(cfg.turnCounts.length - 1, Math.floor(rnd() * cfg.turnCounts.length))];

    base.push({ shape, x, y, z, scale, baseQuat, spinAxis, turns });
  }

  // Tile vertically.
  const halfFov = (cfg.camera.fovDeg * Math.PI) / 360;
  const out: FieldInstance[] = [];
  for (const p of base) {
    const dist = Math.max(0.01, cfg.camera.z - p.z);
    const halfH = dist * Math.tan(halfFov);
    // A pill can stick out by its own half-length in any orientation.
    const margin = halfH + p.scale * CAPSULE_LENGTH * 0.5;
    // One spare tile below (it receives the shifted-in copy) and one above.
    const kMin = Math.floor((-margin - p.y) / cfg.period) - 1;
    const kMax = Math.ceil((margin - p.y) / cfg.period) + 1;
    for (let k = kMin; k <= kMax; k++) {
      out.push({ ...p, y: p.y + k * cfg.period });
    }
  }
  return out;
};

/** Per-instance scale vector; caplets are the capsule pressed flat. */
export const instanceScale = (p: FieldInstance, target: THREE.Vector3): THREE.Vector3 =>
  p.shape === "caplet"
    ? target.set(p.scale, p.scale, p.scale * CAPLET_DEPTH)
    : target.set(p.scale, p.scale, p.scale);
