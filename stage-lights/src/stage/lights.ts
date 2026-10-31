/**
 * Stage-light rig definition.
 *
 * Positions, colour cycles and swing motions were measured from the reference
 * clip (768x432, 10 s loop): light-source pixel positions, per-light hue tracks
 * sampled every 0.5 s, and beam angles sampled every 0.17 s.
 */
import * as THREE from "three";

export const LOOP_SECONDS = 10;

/** Reference camera used to place the rig so that version 1 matches 1:1. */
export const BASE_CAMERA = {
  position: new THREE.Vector3(0, 0, 10),
  fov: 50,
  aspect: 16 / 9,
};

export type LightKind = "top" | "mid";

export type LightDef = {
  id: string;
  kind: LightKind;
  /** Source position in reference pixels (768x432 frame). */
  px: [number, number];
  /** Depth of the fixture (world z). */
  z: number;
  /** Hue keyframes in degrees, one every 0.5 s (20 keys = one 10 s loop). */
  hues: number[];
  /** Screen-space swing: angle(t) = base + amp * cos(2*pi*t/period + phase). */
  swing: { base: number; amp: number; phase: number; period: number };
  /** Optional brightness multiplier (the reference's right-hand wash is the dominant light). */
  gain?: number;
};

export const LIGHTS: LightDef[] = [
  {
    id: "T0",
    kind: "top",
    px: [20, 3],
    z: 0.5,
    hues: [245.2, 265.6, 287.8, 310.1, 334.6, 3.3, 33.9, 59.4, 80.4, 100.7, 119.2, 135.8, 150.4, 162.1, 171.9, 181.8, 192.4, 203.5, 215.6, 229.0],
    swing: { base: 28, amp: -8, phase: 0, period: 5 },
  },
  {
    id: "T1",
    kind: "top",
    px: [233, 3],
    z: 0.5,
    hues: [307.4, 324.2, 345.5, 11.4, 41.6, 72.9, 102.6, 128.2, 150.3, 169.5, 184.9, 197.0, 208.4, 221.5, 236.5, 252.6, 267.1, 277.5, 285.5, 294.9],
    swing: { base: 12, amp: -20, phase: 0, period: 5 },
  },
  {
    id: "T2",
    kind: "top",
    px: [540, 3],
    z: 0.5,
    hues: [302.0, 320.9, 343.9, 10.2, 39.0, 69.9, 100.8, 126.9, 146.9, 163.8, 179.0, 192.7, 206.1, 220.2, 235.6, 251.5, 265.0, 273.5, 279.1, 287.7],
    swing: { base: -12, amp: 20, phase: 0.3, period: 5 },
  },
  {
    id: "T3",
    kind: "top",
    px: [760, 3],
    z: 0.5,
    hues: [20.0, 40.5, 59.8, 71.0, 103.5, 155.2, 182.5, 198.8, 223.8, 246.0, 261.8, 273.5, 284.0, 293.8, 304.2, 316.2, 329.5, 342.2, 353.0, 4.8],
    swing: { base: -21, amp: 11, phase: 0, period: 5 },
    gain: 1.6,
  },
  {
    id: "M0",
    kind: "mid",
    px: [123, 143],
    z: -1,
    hues: [221.1, 236.4, 255.7, 276.2, 297.0, 325.8, 5.4, 40.7, 63.4, 81.0, 99.4, 116.2, 129.1, 141.4, 153.5, 166.0, 179.2, 189.3, 197.0, 208.0],
    swing: { base: 15, amp: 40, phase: 0, period: 5 },
  },
  {
    id: "M1",
    kind: "mid",
    px: [330, 144],
    z: -1,
    hues: [43.5, 61.0, 80.3, 98.6, 120.8, 154.6, 194.0, 222.8, 243.2, 266.2, 284.2, 292.4, 301.6, 315.2, 328.4, 339.1, 350.8, 7.5, 22.3, 31.7],
    swing: { base: 15, amp: 37, phase: 0, period: 5 },
  },
  {
    id: "M2",
    kind: "mid",
    px: [444, 144],
    z: -1,
    hues: [235.7, 251.1, 276.8, 312.2, 341.6, 6.3, 39.4, 81.8, 116.9, 125.7, 118.5, 120.9, 132.8, 146.9, 167.9, 193.7, 216.3, 228.5, 228.1, 226.9],
    swing: { base: -15, amp: -37, phase: 0, period: 5 },
  },
  {
    id: "M3",
    kind: "mid",
    px: [648, 145],
    z: -1,
    hues: [41.7, 57.9, 76.2, 92.0, 110.0, 141.5, 184.0, 220.2, 246.0, 268.8, 287.0, 296.6, 303.1, 314.9, 330.4, 343.1, 353.9, 7.6, 21.4, 31.2],
    swing: { base: -15, amp: -40, phase: 0, period: 5 },
  },
];

export const BEAM_PARAMS: Record<
  LightKind,
  { tanA: number; length: number; intensity: number; towardCamera: number; glowSize: number; glowIntensity: number }
> = {
  top: { tanA: 0.28, length: 9.5, intensity: 1.6, towardCamera: 0.3, glowSize: 1.7, glowIntensity: 1.6 },
  mid: { tanA: 0.24, length: 5, intensity: 0.65, towardCamera: 0.5, glowSize: 1.25, glowIntensity: 1.3 },
};

/** Unproject a reference pixel position onto the plane z = depth. */
export const fixturePosition = (px: [number, number], depth: number) => {
  const halfH = (BASE_CAMERA.position.z - depth) * Math.tan(THREE.MathUtils.degToRad(BASE_CAMERA.fov / 2));
  const halfW = halfH * BASE_CAMERA.aspect;
  const xNdc = (px[0] / 768) * 2 - 1;
  const yNdc = 1 - (px[1] / 432) * 2;
  return new THREE.Vector3(xNdc * halfW, yNdc * halfH, depth);
};

/** Circular interpolation of the hue keyframes (seamless 10 s loop). */
export const hueAt = (hues: number[], t: number) => {
  const step = LOOP_SECONDS / hues.length;
  const pos = (((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS) / step;
  const i0 = Math.floor(pos) % hues.length;
  const i1 = (i0 + 1) % hues.length;
  const f = pos - Math.floor(pos);
  // smooth (Catmull-Rom-like) easing between keys
  const e = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
  let d = hues[i1] - hues[i0];
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return (hues[i0] + d * e + 360) % 360;
};

export const swingAngleDeg = (swing: LightDef["swing"], t: number) =>
  swing.base + swing.amp * Math.cos((2 * Math.PI * t) / swing.period + swing.phase);

/** Beam direction in world space for a given screen-space swing angle. */
export const beamDirection = (angleDeg: number, towardCamera: number) => {
  const a = THREE.MathUtils.degToRad(angleDeg);
  return new THREE.Vector3(Math.sin(a), -Math.cos(a), towardCamera).normalize();
};

/** Number of filter slots on each fixture's colour wheel. */
export const WHEEL_SLOTS = 8;
/** Fraction of each slot spent sweeping into the next colour (reference holds splits ~1 s). */
const SPLIT_FRACTION = 0.85;

/**
 * Colour-wheel model: the measured continuous hue track is quantised to wheel
 * slots. During the last part of each slot the next filter sweeps across the
 * beam, producing the two-colour "split beam" seen in the reference.
 */
export const wheelState = (hues: number[], t: number) => {
  const h = hueAt(hues, t);
  const step = 360 / WHEEL_SLOTS;
  const slotPos = h / step;
  const k = Math.floor(slotPos);
  const f = slotPos - k;
  const sweep = Math.min(1, Math.max(0, (f - (1 - SPLIT_FRACTION)) / SPLIT_FRACTION));
  // gentle easing only at the ends, so the two-colour split is held through the middle
  const eased = 0.15 * sweep * sweep * (3 - 2 * sweep) + 0.85 * sweep;
  return {
    hueA: (k * step) % 360,
    hueB: ((k + 1) * step) % 360,
    // split coordinate across the beam: +1.1 = all A, -1.1 = all B (visible core is ~|0.8|)
    split: 1.1 - 2.2 * eased,
    // blended hue for things that cannot split (glows, wall scatter)
    hueMix: h,
  };
};

/** Small deterministic per-frame intensity shimmer (lamp / haze flicker). */
export const shimmer = (frame: number, index: number) => {
  const x = Math.sin(frame * 12.9898 + index * 78.233) * 43758.5453;
  return 1 + 0.06 * (x - Math.floor(x) - 0.5);
};
