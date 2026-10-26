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
  emitStart: 0.12,
  emitEnd: 6.3,
  source: [-4.9, 0.1, 0],
  shellRadius: { base: 2.5, extra: 1.7, decay: 1.0 },
  forwardSpeed: { base: 1.15, extra: 0.6, decay: 1.2 },
  coneInner: { base: 0, extra: 28, decay: 1.0 },
  coneAngle: { base: 180, extra: -108, decay: 1.0 },
  expansionDrag: 1.9,
  forwardRamp: 1.5,
  turbulence: 1.0,
  turbulenceScale: 0.3,
};

// Linear-light colours by emission time: gold -> orange -> pink -> violet
// -> blue, so the leading cap stays warm and the trailing body turns blue.
const colorStops: SmokeBurstProps["colorStops"] = [
  { te: 0.0, color: [1.0, 0.55, 0.12] },
  { te: 0.45, color: [1.0, 0.3, 0.03] },
  { te: 1.1, color: [0.95, 0.28, 0.32] },
  { te: 1.7, color: [0.55, 0.35, 0.95] },
  { te: 2.3, color: [0.12, 0.38, 1.0] },
  { te: 6.3, color: [0.1, 0.45, 1.0] },
];

const look: SmokeBurstProps["look"] = {
  exposure: 1.0,
  glow: 0.9,
  background: [0, 0, 0],
  lineWidth: 2.6,
};

// Version 1: matches the reference -- near-static side-on camera with a slow
// push-in; the burst travels left to right across frame.
export const smokeV1: SmokeBurstProps = {
  sim,
  colorStops,
  hueSpread: 0.9,
  intensity: 0.26,
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

// Version 2: same simulation and palette, filmed with a sweeping orbit --
// the camera starts high and three-quarter-front of the burst and swings
// round toward a side view while pushing in.
export const smokeV2: SmokeBurstProps = {
  ...smokeV1,
  camera: {
    angleStart: 62,
    angleEnd: 18,
    distanceStart: 15.5,
    distanceEnd: 12.0,
    heightStart: 4.5,
    heightEnd: 1.2,
    target: [0.8, 0, 0],
    fovY: 38,
  },
};
