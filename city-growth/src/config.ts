/**
 * Colours, counts and timings of the city-growth animation.
 * Light / atmosphere / lens settings live in look.ts.
 * World units: 1 unit is roughly 12 m. The city centre is the origin.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 450; // 15.000 s, same as the reference
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Piecewise curve: [time in seconds, value]. Interpolated smoothly. */
export type Keys = ReadonlyArray<readonly [number, number]>;

export const CONFIG = {
  seed: 20260711,

  // ------------------------------------------------------------- layout
  landRadius: 30, // mean radius of the island
  landCentre: [4.2, 4.7] as [number, number], // the island is off-centre: the coast is close on one side
  coastWobble: 0.11, // large coastline variation (fraction of radius)
  gridHalfSize: 50, // street grid extent before the coast clips it
  blockMin: 2.6, // street spacing range
  blockMax: 3.8,
  gridRotation: 0.42, // radians
  warpLarge: 4.2, // how far the street grid is bent (large scale)
  warpSmall: 0.8, // (small scale)
  majorEvery: 3, // every n-th street is an avenue
  minorStreetDelay: 24, // side streets are drawn this much later (street distance)
  roadMinor: 0.3,
  roadMajor: 0.62,
  sidewalk: 0.07,
  parkChance: 0.035,
  towerChanceCentre: 0.9, // chance that a block carries a tower, at the centre
  towerChanceEdge: 0.03, // ... and at the coast
  centreFalloff: 16, // radius over which the skyline drops off
  towerMin: 3.6,
  towerMax: 9.5,
  heroHeight: 10.5,
  glassChanceTower: 0.8,
  glassChanceLow: 0.07,
  floorHeight: 0.16,

  // ------------------------------------------------------------ highways
  deckHeight: 1.15,
  deckWidth: 0.78,
  pillarEvery: 2.6,

  // ------------------------------------------------------------- timings
  /** Path distance (along streets, from the centre) the road front has reached. */
  roadFront: [
    [0.3, -1],
    [0.55, 3.5],
    [1.0, 8],
    [2.0, 17],
    [3.0, 29],
    [4.0, 44],
    [5.0, 62],
    [5.6, 85],
    [6.8, 135],
  ] as Keys,
  /** Radius the white ground tiles have reached. */
  tileFront: [
    [0.45, -8],
    [0.7, 0],
    [1.0, 5],
    [2.0, 10],
    [3.0, 15.5],
    [4.0, 21],
    [5.0, 27],
    [6.0, 34],
    [6.8, 48],
  ] as Keys,
  /** Radius the building front has reached. */
  buildFront: [
    [1.55, 0],
    [1.72, 6],
    [2.0, 7.5],
    [3.0, 10],
    [4.0, 13],
    [5.0, 16.5],
    [6.0, 20.5],
    [7.0, 25.5],
    [8.0, 31],
    [8.6, 37],
    [9.1, 46],
  ] as Keys,
  roadAgeStart: 5, // a street starts to darken when the front is this far ahead
  roadAgeEnd: 22, // ... and is fully dark at this distance
  buildJitter: 0.35, // random extra delay per building (s)
  ghostLead: 0.5, // the construction-line ghost appears this long before the solid
  riseTime: 0.5, // time a building takes to rise
  highwayStart: [2.1, 2.9, 3.9], // start time of each elevated road (s)
  highwaySpeed: [20, 17, 18], // draw-on speed (units / s)

  // ------------------------------------------------------------- colours
  // Surface colours are albedos (sRGB hex). They are deliberately near
  // neutral: the cyan cast of the picture comes from the light (see look.ts).
  colors: {
    land: "#bebebe",
    tile: "#f3f3f3",
    tileMature: "#737275", // ground tiles once the buildings have arrived,
    tileEdge: "#7a7a7a",
    roadNew: "#7a6d66", // a street right after it is drawn ...
    roadOld: "#2e2523", // ... and once the city has grown around it
    pad: "#737275",
    park: "#7ca881",
    wallsLow: ["#6f6667", "#817879", "#5d5556", "#8d8585"], // low-rise walls
    wallsTower: ["#b3aaa9", "#c4bbb9", "#a39a99", "#d0c7c5"], // concrete towers
    roof: "#dcd3d0",
    glassLow: "#0f2630",
    glassHigh: "#1f4050",
    glassEdge: "#a9bcc4",
    deck: "#735f59",
    deckSide: "#b0a6a3",
  },
} as const;

/**
 * Camera moves. Each key: time (s), azimuth (deg), elevation (deg), distance,
 * and the look-at target (x, y, z). The only thing Version 2 changes.
 */
export type CameraKey = {
  t: number;
  az: number;
  el: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
};

export const CAMERA_FOV = 32; // vertical, degrees (measured from the lean of the towers in the reference)

export const CAMERAS: Record<"v1" | "v2", ReadonlyArray<CameraKey>> = {
  // Version 1: like the reference. Starts low and close over the first street,
  // rises and pulls back while orbiting, eases to a stop at 11.5 s and holds.
  v1: [
    { t: 0.0, az: 30, el: 54, dist: 29.0, tx: 1.0, ty: 0.0, tz: 0.5 },
    { t: 1.0, az: 33, el: 52, dist: 29.0, tx: 0.6, ty: 0.4, tz: 0.2 },
    { t: 1.5, az: 35, el: 50, dist: 28.5, tx: 0.3, ty: 1.6, tz: 0.0 },
    { t: 2.2, az: 39, el: 45, dist: 27.0, tx: 0.0, ty: 2.4, tz: 0.0 },
    { t: 3.7, az: 48, el: 40, dist: 27.0, tx: 0.0, ty: 2.6, tz: -0.3 },
    { t: 5.5, az: 58, el: 42, dist: 30.0, tx: -0.3, ty: 2.0, tz: -1.0 },
    { t: 8.0, az: 68, el: 47, dist: 33.5, tx: -0.7, ty: 1.4, tz: -2.2 },
    { t: 11.5, az: 73, el: 49, dist: 35.0, tx: -1.0, ty: 1.0, tz: -3.0 },
    { t: 15.0, az: 73, el: 49, dist: 35.0, tx: -1.0, ty: 1.0, tz: -3.0 },
  ],
  // Version 2: a different camera move. Starts as a straight-down plan view
  // that climbs while the streets spread, then cranes down and orbits the
  // other way into a low three-quarter view across the skyline, still moving
  // at the end.
  v2: [
    { t: 0.0, az: 60, el: 88, dist: 24, tx: 0.0, ty: 0.0, tz: 0.0 },
    { t: 1.5, az: 52, el: 86, dist: 30, tx: 0.0, ty: 0.0, tz: 0.0 },
    { t: 3.5, az: 36, el: 78, dist: 44, tx: 0.0, ty: 0.5, tz: 0.0 },
    { t: 6.0, az: 6, el: 58, dist: 56, tx: 0.0, ty: 1.5, tz: 0.0 },
    { t: 9.0, az: -34, el: 38, dist: 54, tx: 0.0, ty: 2.5, tz: 0.0 },
    { t: 12.0, az: -70, el: 28, dist: 45, tx: 0.0, ty: 3.0, tz: 0.0 },
    { t: 15.0, az: -98, el: 23, dist: 39, tx: 0.0, ty: 3.0, tz: 0.0 },
  ],
};
