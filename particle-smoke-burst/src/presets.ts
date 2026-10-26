import type { SmokeBurstProps } from "./SmokeBurst";

export const FPS = 30;
// Reference clip: 6.2917 s (151 frames at 24 fps). At 30 fps the closest
// whole-frame length is 189 frames = 6.300 s.
export const DURATION_IN_FRAMES = 189;
export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

const sim: SmokeBurstProps["sim"] = {
  seed: 11,
  strands: 4000,
  particlesPerStrand: 64,
  arcStep: 0.026,
  emitStart: 0.0,
  emitEnd: 6.3,
  source: [-4.9, 0.1, 0],
  shellRadius: { base: 2.4, extra: 1.4, decay: 1.0 },
  forwardSpeed: { base: 1.15, extra: 0.6, decay: 1.2 },
  coneInner: { base: 0, extra: 28, decay: 1.0 },
  coneAngle: { base: 180, extra: -108, decay: 1.0 },
  expansionDrag: 1.9,
  forwardRamp: 1.5,
  turbulence: 1.0,
  turbulenceScale: 0.3,
  roll: 0,
  rollDecay: 0.6,
};

// Linear-light colours by emission time: gold -> orange -> pink -> violet
// -> blue, so the leading cap stays warm and the trailing body turns blue.
const colorStops: SmokeBurstProps["colorStops"] = [
  { te: 0.0, color: [1.0, 0.74, 0.38] },
  { te: 0.18, color: [1.0, 0.42, 0.07] },
  { te: 0.6, color: [1.0, 0.28, 0.03] },
  { te: 1.2, color: [0.95, 0.34, 0.42] },
  { te: 1.7, color: [0.5, 0.4, 1.0] },
  { te: 2.2, color: [0.22, 0.4, 1.0] },
  { te: 6.3, color: [0.28, 0.48, 1.0] },
];

const look: SmokeBurstProps["look"] = {
  exposure: 1.0,
  glow: 0.9,
  background: [0, 0, 0],
  lineWidth: 3.2,
  saturation: 1.45,
};

// Version 1: matches the reference -- near-static side-on camera with a slow
// push-in; the burst travels left to right across frame.
export const smokeV1: SmokeBurstProps = {
  sim,
  colorStops,
  hueSpread: 0.9,
  intensity: 0.22,
  volume: 0.03,
  look,
  camera: {
    angleStart: 11,
    angleEnd: 16,
    distanceStart: 15.2,
    distanceEnd: 14.4,
    heightStart: 0.15,
    heightEnd: 0.3,
    target: [0.3, 0, 0],
    fovY: 35,
  },
};

// Version 2: same simulation and palette, filmed with a different camera --
// a low-angle three-quarter view from ahead of the burst that slowly orbits
// round while staying low, so the cap rolls toward the lens.
export const smokeV2: SmokeBurstProps = {
  ...smokeV1,
  camera: {
    angleStart: 60,
    angleEnd: 42,
    distanceStart: 14.5,
    distanceEnd: 18.0,
    heightStart: -3.4,
    heightEnd: -2.4,
    target: [1.0, 0.6, 0],
    fovY: 40,
  },
};
