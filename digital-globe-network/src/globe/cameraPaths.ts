import * as THREE from "three";
import { DEG, monotoneCubic, smoothstep } from "./math";

export type CameraVariant = "reference" | "orbit";

export type CameraSample = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Focus distance (world units) for the depth-of-field point shader. */
  focus: number;
  /** Aperture (CoC scale) - large values = shallow depth of field. */
  aperture: number;
};

type Keys = { t: number[]; dist: number[]; elev: number[]; azim: number[]; tx: number[]; ty: number[] };

const build = (k: Keys) => ({
  dist: monotoneCubic(k.t, k.dist),
  elev: monotoneCubic(k.t, k.elev),
  azim: monotoneCubic(k.t, k.azim),
  tx: monotoneCubic(k.t, k.tx),
  ty: monotoneCubic(k.t, k.ty),
});

/**
 * Version 1 (matches reference): starts skimming just above the dotted
 * surface, fully defocused, racks into focus and then pulls back in one long
 * continuous move until the whole globe and its rings sit centre frame.
 */
const REFERENCE = build({
  t: [0, 1.5, 3, 5, 7.5, 9, 11, 13, 15, 18, 22, 26, 29.7],
  dist: [1.17, 1.3, 1.5, 1.82, 2.28, 2.62, 3.02, 3.32, 3.55, 3.8, 4.05, 4.25, 4.4],
  elev: [40, 38, 33, 27, 22, 20, 18, 16.5, 15.5, 14.5, 13.5, 13, 12.5],
  azim: [8, 7, 6, 4, 2, 0, -1, -1, 0, 0, 0, 0, 0],
  tx: [0.22, 0.2, 0.15, 0.08, 0.1, 0.2, 0.14, 0.05, 0.02, 0.0, 0.02, 0.05, 0.06],
  ty: [0.78, 0.86, 0.88, 0.74, 0.5, 0.36, 0.2, 0.09, 0.05, 0.03, 0.02, 0.02, 0.02],
});

/**
 * Version 2 (alternative camera): the reverse journey from a different angle.
 * Opens wide and low (looking up at the globe from below the ring plane),
 * orbits ~110 degrees around it while rising above the rings, and finishes
 * with a push-in to a close, high-angle view of the glowing limb.
 */
const ORBIT = build({
  t: [0, 4, 8, 12, 16, 20, 24, 27, 29.7],
  dist: [5.6, 5.2, 4.6, 3.9, 3.2, 2.55, 1.95, 1.62, 1.45],
  elev: [-22, -17, -10, -2, 6, 14, 22, 27, 30],
  azim: [-70, -55, -38, -20, -2, 14, 28, 36, 40],
  tx: [0.0, 0.0, 0.0, 0.0, -0.02, -0.06, -0.15, -0.25, -0.3],
  ty: [0.0, 0.0, 0.0, 0.0, 0.05, 0.18, 0.42, 0.6, 0.7],
});

const sample = (track: ReturnType<typeof build>, t: number) => {
  const d = track.dist(t);
  const el = track.elev(t) * DEG;
  const az = track.azim(t) * DEG;
  const position = new THREE.Vector3(d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az));
  // Target offsets are expressed in the camera's screen-aligned frame so
  // "tx" is always screen-right and "ty" world-up regardless of azimuth.
  const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
  const target = new THREE.Vector3(0, track.ty(t), 0).addScaledVector(right, track.tx(t));
  return { position, target };
};

export const cameraAt = (variant: CameraVariant, t: number): CameraSample => {
  if (variant === "reference") {
    const { position, target } = sample(REFERENCE, t);
    const toTarget = position.distanceTo(target);
    // Rack focus: starts focused far behind the surface (everything soft),
    // pulls focus onto the surface by ~2.2 s, then tracks the globe.
    const pull = smoothstep(0.3, 2.6, t);
    const focus = (1 - pull) * 1.05 + pull * Math.max(toTarget, position.length() - 0.55);
    const aperture = 0.7 - 0.25 * smoothstep(3, 12, t);
    return { position, target, focus, aperture };
  }
  const { position, target } = sample(ORBIT, t);
  // Focus holds on the globe front surface; at the end the near particles
  // drift through defocused foreground for depth.
  const focus = Math.max(0.35, position.length() - 0.75);
  const aperture = 0.5 + 0.45 * smoothstep(18, 28, t);
  return { position, target, focus, aperture };
};

const rotationTable = (() => {
  // Globe spin speed (deg/s): slow during the close-up intro, then the
  // ~18 deg/s rotation seen in the reference once the camera pulls back.
  const speed = (t: number) => 2 + 16 * smoothstep(5, 12, t);
  const dt = 1 / 120;
  const table: number[] = [0];
  for (let i = 1; i <= 30 * 120; i++) table.push(table[i - 1] + speed((i - 0.5) * dt) * dt);
  return table;
})();

/** Longitude (deg) that faces the reference camera at time t. */
export const facingLongitude = (t: number) => {
  const idx = Math.min(rotationTable.length - 1, Math.max(0, t * 120));
  const i0 = Math.floor(idx);
  const f = idx - i0;
  const a = rotationTable[i0];
  const b = rotationTable[Math.min(rotationTable.length - 1, i0 + 1)];
  const v = a + (b - a) * f;
  // Calibrated so the Americas face camera at ~9 s and Asia at ~17-19 s.
  const at9 = rotationTable[9 * 120];
  return v - at9 - 85;
};
