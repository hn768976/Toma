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
    // Lead traffic: opens low and right of the hero, well in front of the
    // focal plane so it reads large and soft, then slides out of frame
    // bottom-left as the camera descends.
    {
      screenX: [
        [0, 0.34],
        [0.6, -0.92],
      ],
      screenY: [
        [0, -0.38],
        [0.6, -1.15],
      ],
      depthRatio: [
        [0, 0.62],
        [0.6, 0.45],
      ],
      headingOffsetDeg: [
        [0, -9],
        [0.6, -20],
      ],
      scale: 1,
      opacity: [
        [0, 1],
        [0.42, 1],
        [0.58, 0],
      ],
    },
    // Second aircraft crossing the lower right around the midpoint, so the
    // sky does not empty out before the descent finishes.
    {
      screenX: [
        [0.42, 0.72],
        [1, 1.45],
      ],
      screenY: [
        [0.42, -0.5],
        [1, -0.95],
      ],
      depthRatio: [
        [0.42, 0.72],
        [1, 0.52],
      ],
      headingOffsetDeg: [
        [0.42, 13],
        [1, 22],
      ],
      scale: 1,
      opacity: [
        [0, 0],
        [0.44, 0],
        [0.54, 1],
        [0.8, 1],
        [0.9, 0],
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
