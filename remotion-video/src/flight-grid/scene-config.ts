import type { Keyframes, RigConfig } from "./rig";
import { DURATION_IN_FRAMES, FPS } from "./constants";

// Companion traffic. Reference B opens on two jets and is down to one by
// the time the camera has finished descending, and the extra aircraft sit
// well in front of the focal plane — so they are rendered on their own
// defocused layer.
//
// Placement is camera-relative rather than in the hero's local frame: the
// camera orbits the hero by tens of degrees over the shot, so a fixed
// world offset swings wildly across (and off) the frame. Screen position
// and depth are what actually needs art-directing here.
export type CompanionConfig = {
  /** Horizontal position, in half-frame widths. +1 is the right edge. */
  screenX: Keyframes;
  /** Vertical position, in half-frame heights. +1 is the top edge. */
  screenY: Keyframes;
  /** Distance from the camera as a fraction of the focal distance.
   *  Below 1 puts the aircraft in front of the focal plane, so it reads
   *  both larger than the hero and softer. */
  depthRatio: Keyframes;
  headingOffsetDeg: Keyframes;
  scale: number;
  opacity: Keyframes;
};

export type SceneConfig = {
  rig: RigConfig;
  companions: CompanionConfig[];
  routeSeed: number;
  heroScale: number;
  gridOpacity: Keyframes;
  routeOpacity: Keyframes;
  /** Strength of the corner falloff, 0..1. */
  vignette: number;
};

const DURATION_SEC = DURATION_IN_FRAMES / FPS;

const COMMON = {
  fovDeg: 34,
  near: 5,
  far: 7000,
  durationSec: DURATION_SEC,
  planeAltitude: 24,
  focusBias: 0,
  bankGain: 4,
} as const;

// Version 1 — the close, slow read of reference A: one jet holding frame
// centre, big graticule cells sliding past, the whole grid slowly rotating
// as the camera creeps around the aircraft.
export const VERSION_ONE: SceneConfig = {
  rig: {
    ...COMMON,
    track: {
      lat0Deg: 0,
      lon0Deg: -6,
      speed: 26,
      latAmpDeg: 0.55,
      latPeriodSec: 26,
      latPhase: 0.6,
      lonAmpDeg: 0.35,
      lonPeriodSec: 19,
      lonPhase: 2.1,
    },
    camDistance: [
      [0, 201],
      [1, 187],
    ],
    camElevationDeg: [
      [0, 37],
      [1, 32.5],
    ],
    camAzimuthDeg: [
      [0, -16],
      [1, 20],
    ],
    camRollDeg: [
      [0, -3.2],
      [0.55, 1.4],
      [1, -2.1],
    ],
    aimOffsetX: [
      [0, 0.02],
      [1, -0.03],
    ],
    aimOffsetY: [
      [0, 0.08],
      [1, 0.03],
    ],
  },
  companions: [],
  routeSeed: 20269,
  heroScale: 1,
  gridOpacity: [
    [0, 1],
    [1, 1],
  ],
  routeOpacity: [
    [0, 1],
    [1, 1],
  ],
  vignette: 0.62,
};

// Version 2 — the descent of reference B: starts high and wide on a fine
// graticule with a second jet in the foreground, then drops and closes in
// until it matches version 1's framing on a single aircraft.
export const VERSION_TWO: SceneConfig = {
  rig: {
    ...COMMON,
    track: {
      lat0Deg: 0,
      lon0Deg: -9,
      speed: 30,
      latAmpDeg: 0.7,
      latPeriodSec: 22,
      latPhase: 1.9,
      lonAmpDeg: 0.4,
      lonPeriodSec: 17,
      lonPhase: 0.4,
    },
    camDistance: [
      [0, 430],
      [1, 190],
    ],
    camElevationDeg: [
      [0, 46],
      [1, 33],
    ],
    camAzimuthDeg: [
      [0, -28],
      [1, 14],
    ],
    camRollDeg: [
      [0, 2.6],
      [0.5, -1.8],
      [1, 1.2],
    ],
    aimOffsetX: [
      [0, -0.06],
      [1, 0],
    ],
    aimOffsetY: [
      [0, 0.22],
      [1, 0.06],
    ],
  },
  companions: [
    // The second jet from reference B, on a course that crosses the
    // hero's. It opens low and right, well in front of the focal plane so
    // it reads large and soft, then sweeps left across the lower frame and
    // out of shot — passing under the hero rather than flying alongside
    // it. The heading offset is what sells the crossing: the two are on
    // visibly different tracks, not in formation.
    {
      screenX: [
        [0, 0.52],
        [0.75, -1.35],
      ],
      screenY: [
        [0, -0.34],
        [0.75, -0.74],
      ],
      depthRatio: [
        [0, 0.6],
        [0.75, 0.38],
      ],
      headingOffsetDeg: [
        [0, -34],
        [0.75, -48],
      ],
      scale: 1,
      // Fully out of frame by t = 0.7, so the fade itself is never seen.
      opacity: [
        [0, 1],
        [0.7, 1],
        [0.78, 0],
      ],
    },
  ],
  routeSeed: 22711,
  heroScale: 1,
  gridOpacity: [
    [0, 1],
    [1, 1],
  ],
  routeOpacity: [
    [0, 1.25],
    [1, 1.25],
  ],
  vignette: 0.58,
};
