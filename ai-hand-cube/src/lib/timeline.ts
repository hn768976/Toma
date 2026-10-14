// Pure functions of the frame. Everything that moves on screen is computed
// here (or in shaders from values computed here). No state, no clocks.
import { Easing, interpolate } from "remotion";
import type { Version } from "../versions";

export const FPS = 30;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (t: number, a: number, b: number, ease = Easing.inOut(Easing.cubic)) =>
  interpolate(t, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export type SceneState = {
  /** seconds used by shader pulses; periodic over the loop length for loops */
  t: number;
  /** frame index modulo composition length (grain seed) */
  frameMod: number;
  hudOpacity: number;
  /** 0 = below frame, 1 = settled */
  handRise: number;
  /** extra finger curl (radians) added to the relaxed pose, per finger [thumb, index, middle, ring, little] */
  fingerCurl: [number, number, number, number, number];
  squareGlow: number; // flat glowing square on the palm
  particles: number; // particle emission strength 0..1
  particleStart: number; // seconds when emission started (story) - particles born before are hidden
  cubeLift: number; // 0 = square on palm, 1 = cube floating
  edgeBottom: number; // bottom square edges drawn
  edgeVertical: number; // vertical edges grown
  edgeTop: number; // top square edges drawn
  glass: number; // glass faces 0..1
  circuit: number; // circuit trace reveal 0..1 (from centre out)
  innerGlow: number; // 0..1
  aiOn: number; // AI letters 0..1
  aiFlash: number; // short flash 0..1
  cubeRotY: number; // radians
  cubeBob: number; // world units
  camYaw: number; // radians orbit
  camPitch: number;
  camPush: number; // 0..1 dolly in
  hudDrift: number; // phase 0..1 for panel drift (whole cycles over loop)
  loop: boolean;
  /** tick index for HUD text, already wrapped to the loop for loops */
  frame: number;
};

const BASE_ROT = 30 * DEG;

export const computeState = (frame: number, v: Version): SceneState => {
  const L = v.durationInFrames;
  const f = ((frame % L) + L) % L;
  if (v.timeline === "loop") {
    const phi = f / L; // 0..1 over the loop
    const flex = (i: number, cycles: number, amp: number) =>
      amp * DEG * (0.5 - 0.5 * Math.cos(TAU * (cycles * phi + i * 0.17)));
    return {
      t: f / FPS,
      frameMod: f,
      hudOpacity: 1,
      handRise: 1,
      fingerCurl: [
        6 * DEG + flex(0, 2, 3),
        6 * DEG + flex(1, 3, 4),
        6 * DEG + flex(2, 3, 4),
        6 * DEG + flex(3, 2, 4),
        6 * DEG + flex(4, 2, 5),
      ],
      squareGlow: 1,
      particles: 1,
      particleStart: -1000,
      cubeLift: 1,
      edgeBottom: 1,
      edgeVertical: 1,
      edgeTop: 1,
      glass: 1,
      circuit: 1,
      innerGlow: 1,
      aiOn: 1,
      aiFlash: 0,
      cubeRotY: BASE_ROT + 20 * DEG * Math.cos(TAU * phi),
      cubeBob: 0.035 * Math.sin(TAU * 2 * phi),
      camYaw: 6 * DEG * Math.sin(TAU * phi),
      camPitch: 1.2 * DEG * Math.sin(TAU * 2 * phi),
      camPush: 0.5,
      hudDrift: phi,
      loop: true,
      frame: f,
    };
  }

  // Story timeline (15s)
  const s = f / FPS;
  const curl = 7 * DEG * ramp(s, 3.5, 6.5);
  const holdT = Math.max(0, s - 9.5);
  const holdIn = ramp(s, 9.5, 11.5);
  // flash: quick attack, slower decay, peak around 8.75s
  const flash =
    s < 8.5 ? 0 : s < 8.75 ? (s - 8.5) / 0.25 : Math.exp(-(s - 8.75) * 4.5);
  return {
    t: s,
    frameMod: f,
    hudOpacity: ramp(s, 0, 1.6, Easing.out(Easing.quad)),
    handRise: ramp(s, 0.1, 2.0, Easing.out(Easing.cubic)),
    fingerCurl: [curl * 0.6, curl, curl, curl, curl * 1.1],
    squareGlow: ramp(s, 2.0, 2.7, Easing.out(Easing.quad)),
    particles: ramp(s, 2.3, 3.3),
    particleStart: 2.3,
    cubeLift: ramp(s, 3.5, 5.0),
    edgeBottom: ramp(s, 2.0, 2.9, Easing.out(Easing.quad)),
    edgeVertical: ramp(s, 3.6, 5.0),
    edgeTop: ramp(s, 4.8, 5.9),
    glass: ramp(s, 5.2, 6.5),
    circuit: ramp(s, 6.5, 8.5, Easing.inOut(Easing.quad)),
    innerGlow: 0.25 * ramp(s, 4.5, 6.5) + 0.75 * ramp(s, 6.5, 8.6),
    aiOn: ramp(s, 8.5, 8.75, Easing.out(Easing.quad)),
    aiFlash: clamp01(flash),
    cubeRotY:
      BASE_ROT +
      // slow settle during the build, then ±15° during the hold
      -8 * DEG * (1 - ramp(s, 3.5, 9.5)) +
      -15 * DEG * holdIn * Math.sin((TAU * holdT) / 11),
    cubeBob: 0.03 * Math.sin((TAU * s) / 5) * ramp(s, 5, 7),
    camYaw: 2 * DEG * Math.sin((TAU * s) / 30),
    camPitch: 0,
    camPush: ramp(s, 9.5, 15, Easing.inOut(Easing.sin)),
    hudDrift: s / 20,
    loop: false,
    frame: f,
  };
};
