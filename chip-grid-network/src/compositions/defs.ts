import { Easing, interpolate } from "remotion";
import { GRID_CENTER, GRID_N, SPACING } from "../lib/grid";
import type { CameraShot, CompDef, Vec3 } from "../lib/types";

// ---------------------------------------------------------------------------
// Camera helpers. Every shot is a pure function of the frame.
// ---------------------------------------------------------------------------
const deg = (d: number) => (d * Math.PI) / 180;

/**
 * Orbit-style camera: looks at `target` from `dist` away, `pitch` degrees
 * above the horizon (90 = straight down), from heading `yaw` degrees.
 * The up vector is the horizontal forward direction, which stays valid
 * all the way to a straight-down view (and matches world-up below 90).
 */
const orbit = (target: Vec3, dist: number, pitch: number, yaw: number, fov: number): CameraShot => {
  const p = deg(pitch);
  const y = deg(yaw);
  const h = [Math.sin(y), Math.cos(y)];
  return {
    position: [target[0] + dist * Math.cos(p) * h[0], target[1] + dist * Math.sin(p), target[2] + dist * Math.cos(p) * h[1]],
    target,
    up: [-h[0], 0, -h[1]],
    fov,
  };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (frame: number, start: number, end: number, easing = Easing.inOut(Easing.cubic)) =>
  interpolate(frame, [start, end], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** Grid node nearest to a world point (clamped to the grid). */
const nearestNode = (x: number, z: number): [number, number] => {
  const clamp = (v: number) => Math.max(0, Math.min(GRID_N - 1, v));
  return [clamp(Math.round(x / SPACING + GRID_CENTER)), clamp(Math.round(z / SPACING + GRID_CENTER))];
};

export const FPS = 30;
export const DURATION = 450;

// ---------------------------------------------------------------------------
// 1 - Shield Sweep (top-down, grid at 45 degrees). Red -> blue from the
// centre node in a diamond; shields replace the chip squares.
// ---------------------------------------------------------------------------
export const SHIELD_SWEEP_TOP: CompDef = {
  id: "ChipGrid-ShieldSweepTop",
  from: "compromised",
  to: "safe",
  shield: "top",
  spread: { sources: [[9, 9]], tStart: 24, stepFrames: 30, metric: "manhattan", jitter: 0.2, seed: 0xc0ffee01 },
  dof: { rangeFactor: 0.6, bokehScale: 0.9 },
  // screen-up on the floor for yaw 45 (see orbit's up vector)
  shieldUpXZ: [-Math.SQRT1_2, -Math.SQRT1_2],
  camera: (f) => {
    // slow push-in, under 5%
    const t = ease(f, 0, DURATION, Easing.inOut(Easing.sin));
    return orbit([0, 0, 0], lerp(43, 41, t), 90, 45, 30);
  },
};

// ---------------------------------------------------------------------------
// 2 - Attack Pullback. Close and low on the centre node, pulling back and up
// to a grid-aligned top-down view while red radiates from that node.
// ---------------------------------------------------------------------------
export const ATTACK_PULLBACK: CompDef = {
  id: "ChipGrid-AttackPullback",
  from: "safe",
  to: "compromised",
  shield: "none",
  spread: { sources: [[9, 9]], tStart: 60, stepFrames: 38, metric: "radial", jitter: 0.15, seed: 0xc0ffee02 },
  dof: { rangeFactor: 0.26, bokehScale: 2.0 },
  camera: (f) => {
    const t = ease(f, 14, 274);
    const drift = ease(f, 274, DURATION, Easing.inOut(Easing.sin));
    const dist = lerp(9, 40, t) - drift * 0.7;
    const pitch = lerp(35, 90, ease(f, 14, 274, Easing.inOut(Easing.quad)));
    const yaw = lerp(-32, 0, t);
    const target: Vec3 = [0, lerp(0.95, 0, t), 0];
    return orbit(target, dist, pitch, yaw, 34);
  },
};

// ---------------------------------------------------------------------------
// 3 - Attack Spread (angled ~40 degrees, grid at 45, slow sideways track).
// Red enters from a node just off the near-left corner of the frame.
// ---------------------------------------------------------------------------
const C3 = { base: [-3, 0, -3] as Vec3, dist: 26, pitch: 40, yaw: 45, fov: 30, track: 5 };
const c3Target = (f: number): Vec3 => {
  const s = lerp(-C3.track, C3.track, ease(f, 0, DURATION, Easing.inOut(Easing.sin)));
  // camera "right" on the floor for this yaw
  const r = [Math.cos(deg(C3.yaw)), -Math.sin(deg(C3.yaw))];
  return [C3.base[0] + r[0] * s, 0, C3.base[2] + r[1] * s];
};
const c3Source = (() => {
  // a point beyond the near-left corner of the opening frame
  const t = c3Target(0);
  const r = [Math.cos(deg(C3.yaw)), -Math.sin(deg(C3.yaw))];
  const fwd = [-Math.sin(deg(C3.yaw)), -Math.cos(deg(C3.yaw))];
  return nearestNode(t[0] + r[0] * -17 + fwd[0] * -11, t[2] + r[1] * -17 + fwd[1] * -11);
})();
export const ATTACK_SPREAD: CompDef = {
  id: "ChipGrid-AttackSpread",
  from: "safe",
  to: "compromised",
  shield: "none",
  spread: { sources: [c3Source], tStart: 20, stepFrames: 16, metric: "manhattan", jitter: 0.2, seed: 0xc0ffee03 },
  dof: { rangeFactor: 0.3, bokehScale: 1.8 },
  camera: (f) => orbit(c3Target(f), C3.dist, C3.pitch, C3.yaw, C3.fov),
};

// ---------------------------------------------------------------------------
// 4 - Shield Recovery (angled ~35 degrees, close, pulling back). Blue spreads
// from the centre node; a floating shield pops up above each safe node.
// ---------------------------------------------------------------------------
export const SHIELD_RECOVERY: CompDef = {
  id: "ChipGrid-ShieldRecovery",
  from: "compromised",
  to: "safe",
  shield: "float",
  spread: { sources: [[9, 9]], tStart: 30, stepFrames: 33, metric: "radial", jitter: 0.15, seed: 0xc0ffee04 },
  dof: { rangeFactor: 0.3, bokehScale: 1.8 },
  camera: (f) => {
    const t = ease(f, 0, 380, Easing.inOut(Easing.cubic));
    const drift = ease(f, 380, DURATION, Easing.inOut(Easing.sin));
    const dist = lerp(13.5, 26, t) + drift * 0.6;
    return orbit([0, lerp(0.9, 0, t), 0], dist, 35, lerp(40, 46, t), 30);
  },
};

export const ALL_COMPS = [SHIELD_SWEEP_TOP, ATTACK_PULLBACK, ATTACK_SPREAD, SHIELD_RECOVERY];
