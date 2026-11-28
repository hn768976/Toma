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
  landCentre: [3.5, 6.0] as [number, number], // the island is off-centre: the coast is close on one side
  coastWobble: 0.13, // large coastline variation (fraction of radius)
  gridHalfSize: 50, // street grid extent before the coast clips it
  blockMin: 2.6, // street spacing range
  blockMax: 3.8,
  gridRotation: 0.42, // radians
  warpLarge: 4.2, // how far the street grid is bent (large scale)
  warpSmall: 0.8, // (small scale)
  majorEvery: 3, // every n-th street is an avenue
  minorStreetDelay: 24, // side streets are drawn this much later (street distance)
  roadMinor: 0.3,
  roadMajor: 0.7,
  sidewalk: 0.07,
  parkChance: 0.035,
  coreRadius: 4.7, // the first cluster of towers grows inside this radius
  coreTowerChance: 0.95,
  coreMin: 6, // heights of the core towers
  coreMax: 11,
  coreBirth: [1.35, 1.8] as [number, number], // seconds between which the core towers start to rise
  /** Landmark glass towers: wished position, footprint and height. */
  heroTowers: [
    { x: 5.9, z: 1.5, w: 2.5, h: 12 },
    { x: 9.5, z: -5.5, w: 2.2, h: 9.5 },
    { x: -3.5, z: -9.5, w: 2.1, h: 9 },
    { x: -9.5, z: 7, w: 2.1, h: 8.5 },
    { x: 10.5, z: 5.5, w: 2.2, h: 9 },
    { x: 4, z: -11, w: 2.0, h: 8 },
  ],
  towerChanceCentre: 0.5, // chance that a block outside the core carries a tower, near the centre
  towerChanceEdge: 0.02, // ... and at the coast
  centreFalloff: 16, // radius over which the skyline drops off
  towerMin: 3.6,
  towerMax: 8,
  glassChanceTower: 0.75,
  glassChanceLow: 0.04,
  floorHeight: 0.16,

  // ------------------------------------------------------------ highways
  deckHeight: 1.1,
  deckWidth: 0.72,
  pillarEvery: 2.6,
  /** The main elevated road, from far out over the water to its ramp in the city. */
  highwayMain: [
    [-70, -52],
    [-48, -36],
    [-30, -22.5],
    [-20, -15],
    [-12, -9],
    [-6.6, -6.2],
    [-6.0, -0.5],
    [-6.6, 5],
    [-3, 10],
    [3, 12.5],
    [6, 17.5],
    [2, 23.5],
    [-6, 27],
  ],
  highwayMainOrigin: 0.62, // it starts to draw here (fraction of its length) and spreads both ways
  /** A second elevated road: an arc on the other side that joins the main one. */
  highwayLoop: [
    [8, -14],
    [13, -6],
    [14.5, 3],
    [11, 11],
    [6, 17.5],
  ],

  // ------------------------------------------------------------- timings
  /** Path distance (along streets, from the centre) the road front has reached. */
  roadFront: [
    [0.3, -1],
    [0.55, 5],
    [1.0, 13],
    [1.5, 22],
    [2.0, 30],
    [3.0, 42],
    [4.0, 58],
    [5.0, 78],
    [5.6, 95],
    [6.8, 140],
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
    [1.5, 0],
    [1.9, 4.7],
    [2.4, 6.5],
    [3.0, 9],
    [4.0, 12.5],
    [5.0, 16.5],
    [6.0, 21],
    [7.0, 26],
    [8.0, 31.5],
    [8.6, 37],
    [9.1, 46],
  ] as Keys,
  roadAgeStart: 5, // a street starts to darken when the front is this far ahead
  roadAgeEnd: 22, // ... and is fully dark at this distance
  buildJitter: 0.35, // random extra delay per building (s)
  ghostLead: 0.45, // the construction-line ghost appears this long before the solid
  riseTime: 0.7, // time a building takes to rise
  highwayStart: [2.3, 2.7], // start time of each elevated road (s)
  highwaySpeed: [14, 11], // draw-on speed (units / s)

  // ------------------------------------------------------------- colours
  // Surface colours are albedos (sRGB hex). They are deliberately near
  // neutral: the cyan cast of the picture comes from the light (see look.ts).
  colors: {
    land: "#bebebe",
    tile: "#f3f3f3",
    tileMature: "#7ea896", // ground tiles once the buildings have arrived,
    tileEdge: "#7a7a7a",
    roadNew: "#8a7d76", // a street right after it is drawn ...
    roadOld: "#3a3130", // ... and once the city has grown around it
    pad: "#b4b3b5",
    park: "#74b08a",
    wallsLow: ["#a39b9a", "#b3abaa", "#938b8a", "#bdb5b3"], // low-rise walls
    wallsTower: ["#c4bbb9", "#d0c7c5", "#b3aaa9", "#d8d0ce"], // concrete towers
    roof: "#efe8e5",
    glassLow: "#12303d",
    glassHigh: "#2a5568",
    glassEdge: "#b5d3e0",
    glassCore: "#3f6a80", // the core seen through the glass
    lane: "#d8d2cf", // dashed centre line of the avenues,
    deck: "#a39a96",
    deckSide: "#cfc7c4",
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
    { t: 0.0, az: 30, el: 56, dist: 29.0, tx: 1.0, ty: 0.0, tz: 0.5 },
    { t: 1.0, az: 33, el: 54, dist: 29.0, tx: 0.6, ty: 0.6, tz: 0.2 },
    { t: 1.5, az: 35, el: 52, dist: 29.0, tx: 0.3, ty: 1.8, tz: 0.0 },
    { t: 2.2, az: 39, el: 46, dist: 27.5, tx: 0.0, ty: 2.6, tz: 0.0 },
    { t: 3.7, az: 48, el: 40, dist: 27.0, tx: 0.0, ty: 2.8, tz: -0.3 },
    { t: 5.5, az: 56, el: 43, dist: 29.0, tx: -0.3, ty: 2.2, tz: -1.0 },
    { t: 7.5, az: 64, el: 46, dist: 32.0, tx: -0.8, ty: 1.6, tz: -2.2 },
    { t: 9.5, az: 74, el: 48.5, dist: 37.0, tx: -1.5, ty: 1.2, tz: -3.6 },
    { t: 11.5, az: 82, el: 50, dist: 41.0, tx: -2.0, ty: 1.0, tz: -4.5 },
    { t: 15.0, az: 82, el: 50, dist: 41.0, tx: -2.0, ty: 1.0, tz: -4.5 },
  ],
  // Version 2: a different camera move. Starts high and steep on the opposite
  // side of the city (close to a plan view) while the streets spread, then
  // cranes down and orbits the other way round into a low view across the
  // skyline, and is still moving on the last frame.
  v2: [
    { t: 0.0, az: 200, el: 72, dist: 26, tx: 0.0, ty: 0.0, tz: 0.0 },
    { t: 1.5, az: 190, el: 68, dist: 27, tx: 0.0, ty: 1.0, tz: 0.0 },
    { t: 3.5, az: 168, el: 60, dist: 34, tx: 0.0, ty: 1.5, tz: 0.0 },
    { t: 6.0, az: 135, el: 46, dist: 44, tx: 0.0, ty: 2.0, tz: 0.0 },
    { t: 9.0, az: 95, el: 34, dist: 46, tx: 0.0, ty: 2.6, tz: 0.0 },
    { t: 12.0, az: 58, el: 27, dist: 43, tx: 0.0, ty: 3.0, tz: 0.0 },
    { t: 15.0, az: 30, el: 23, dist: 39, tx: 0.0, ty: 3.0, tz: 0.0 },
  ],
};
