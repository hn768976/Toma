/**
 * Per-variant configuration. Everything that distinguishes one version of the
 * map from another is a value in this file: the lat/lon viewport, the dot
 * pitch, the endpoint list and the arc styling. The generator in
 * `src/lib/dot-map.ts` reads the viewport from here and knows nothing about
 * what part of the world it is drawing.
 */

/** A lat/lon bounding box, in degrees. */
export type Viewport = {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
};

/** How the projected map is fitted inside the 3840x2160 frame. */
export type MapFit = {
  /** Largest fraction of the frame width the map may occupy. */
  maxWidth: number;
  /** Largest fraction of the frame height the map may occupy. */
  maxHeight: number;
  /** Extra vertical nudge in frame pixels, positive moves the map down. */
  offsetY: number;
};

/**
 * A route runs `from` -> `to`, and that order is the direction of travel: the
 * draw-on starts at `from`, the travelling dots ride toward `to`, and `to` is
 * the endpoint whose pulse fires on completion.
 */
export type Route = {
  from: string;
  to: string;
};

export type VariantConfig = {
  viewport: Viewport;
  fit: MapFit;
  /** Nominal spacing between dot centres, in frame pixels. */
  dotPitch: number;
  /** Dot diameter, in frame pixels. */
  dotSize: number;
  /** How many arcs to build from the route list. */
  arcCount: number;
  /**
   * Arc apex height as a fraction of the straight-line endpoint distance.
   * Calibrated per variant: intercontinental hops can carry a tall bow, short
   * regional hops cannot.
   */
  bowFactor: number;
  /** Floor on the apex height in frame pixels, so short hops still curve. */
  bowMin: number;
  /** Ceiling on the apex height in frame pixels, so nothing loops off-frame. */
  bowMax: number;
  /** Arc stroke width in frame pixels. */
  arcWidth: number;
  /**
   * Shortest arc allowed, in frame pixels. Enforced at build time so a route
   * list can never introduce a stub.
   */
  minArcLength: number;
  /** Named endpoints as [lon, lat]. Entries outside the viewport run off-frame. */
  points: Record<string, [number, number]>;
  /** Endpoint pairs, drawn in order until `arcCount` arcs exist. */
  routes: Route[];
  /** Radius a completed-arc node pulse expands to, in frame pixels. */
  pulseRadius: number;
  /** Radius of a travelling dot, in frame pixels. */
  travellerRadius: number;
  /** Seed prefix, so the two variants never share a random stream. */
  seed: string;
};

const GLOBAL_POINTS: Record<string, [number, number]> = {
  vancouver: [-123.1, 49.28],
  losAngeles: [-118.24, 34.05],
  mexicoCity: [-99.13, 19.43],
  chicago: [-87.63, 41.88],
  newYork: [-74.01, 40.71],
  toronto: [-79.38, 43.65],
  bogota: [-74.07, 4.71],
  lima: [-77.03, -12.05],
  saoPaulo: [-46.63, -23.55],
  buenosAires: [-58.38, -34.6],
  reykjavik: [-21.94, 64.13],
  london: [-0.13, 51.51],
  paris: [2.35, 48.86],
  madrid: [-3.7, 40.42],
  casablanca: [-7.59, 33.57],
  lagos: [3.38, 6.52],
  johannesburg: [28.05, -26.2],
  nairobi: [36.82, -1.29],
  cairo: [31.24, 30.04],
  istanbul: [28.98, 41.01],
  moscow: [37.62, 55.75],
  dubai: [55.27, 25.2],
  tehran: [51.39, 35.69],
  mumbai: [72.88, 19.08],
  delhi: [77.21, 28.61],
  singapore: [103.82, 1.35],
  bangkok: [100.5, 13.76],
  jakarta: [106.85, -6.21],
  hongKong: [114.17, 22.32],
  shanghai: [121.47, 31.23],
  beijing: [116.41, 39.9],
  seoul: [126.98, 37.57],
  tokyo: [139.69, 35.69],
  sydney: [151.21, -33.87],
  auckland: [174.76, -36.85],
};

// Six routes, twelve endpoints, no endpoint used twice - so no two arcs meet at
// the same point. Lengths are deliberately graded, roughly 2400 / 1800 / 1560 /
// 1440 / 1240 / 980 px, so the arcs read as differently sized rather than as one
// repeated shape, and none of them is a stub.
//
// Half the set is declared east-to-west so three arcs draw right to left
// against the other three, rather than the whole network sweeping one way.
//
// Routes are also kept away from vertical. The bow is always straight up, so a
// near-vertical chord curls into a hook rather than reading as a route.
const GLOBAL_ROUTES: Route[] = [
  {from: 'losAngeles', to: 'tokyo'},
  {from: 'jakarta', to: 'toronto'},
  {from: 'saoPaulo', to: 'hongKong'},
  {from: 'dubai', to: 'mexicoCity'},
  {from: 'lima', to: 'moscow'},
  {from: 'delhi', to: 'reykjavik'},
];


const EUROPE_POINTS: Record<string, [number, number]> = {
  lisbon: [-9.14, 38.72],
  porto: [-8.61, 41.15],
  madrid: [-3.7, 40.42],
  valencia: [-0.38, 39.47],
  barcelona: [2.17, 41.39],
  dublin: [-6.26, 53.35],
  edinburgh: [-3.19, 55.95],
  manchester: [-2.24, 53.48],
  london: [-0.13, 51.51],
  paris: [2.35, 48.86],
  brussels: [4.35, 50.85],
  amsterdam: [4.9, 52.37],
  frankfurt: [8.68, 50.11],
  zurich: [8.54, 47.37],
  munich: [11.58, 48.14],
  milan: [9.19, 45.46],
  marseille: [5.37, 43.3],
  rome: [12.5, 41.9],
  naples: [14.25, 40.85],
  berlin: [13.4, 52.52],
  prague: [14.42, 50.08],
  vienna: [16.37, 48.21],
  budapest: [19.04, 47.5],
  zagreb: [15.98, 45.81],
  belgrade: [20.46, 44.82],
  sofia: [23.32, 42.7],
  bucharest: [26.1, 44.43],
  athens: [23.73, 37.98],
  istanbul: [28.98, 41.01],
  ankara: [32.86, 39.93],
  algiers: [3.06, 36.75],
  tunis: [10.18, 36.8],
  copenhagen: [12.57, 55.68],
  oslo: [10.75, 59.91],
  stockholm: [18.07, 59.33],
  helsinki: [24.94, 60.17],
  tallinn: [24.75, 59.44],
  riga: [24.11, 56.95],
  vilnius: [25.28, 54.69],
  warsaw: [21.01, 52.23],
  minsk: [27.56, 53.9],
  kyiv: [30.52, 50.45],
  odesa: [30.73, 46.48],
  stPetersburg: [30.34, 59.93],
  moscow: [37.62, 55.75],
};

// Same rules as the global set: six routes, twelve endpoints, none reused, none
// near-vertical, and three declared east-to-west so half the network draws right
// to left. Lengths run about 2440 / 1830 / 1590 / 1230 / 1080 / 940 px.
//
// The endpoints are also spread across the frame rather than left where the
// shortest routes fall: this box is much wider than it is tall, so every
// non-steep route runs broadly east-west, and without deliberate placement the
// eastern ends all pile into the same corner.
const EUROPE_ROUTES: Route[] = [
  {from: 'lisbon', to: 'moscow'},
  {from: 'istanbul', to: 'dublin'},
  {from: 'madrid', to: 'riga'},
  {from: 'stPetersburg', to: 'zurich'},
  {from: 'oslo', to: 'kyiv'},
  {from: 'athens', to: 'marseille'},
];

export const VARIANTS = {
  global: {
    // Antarctica is deliberately outside the box: it adds nothing and drags
    // the visual mass to the bottom of the frame.
    viewport: {lonMin: -170, lonMax: 180, latMin: -60, latMax: 78},
    fit: {maxWidth: 0.85, maxHeight: 0.78, offsetY: 20},
    dotPitch: 14,
    dotSize: 7,
    arcCount: 6,
    bowFactor: 0.22,
    bowMin: 70,
    bowMax: 620,
    arcWidth: 3,
    minArcLength: 900,
    points: GLOBAL_POINTS,
    routes: GLOBAL_ROUTES,
    pulseRadius: 46,
    travellerRadius: 4.5,
    seed: 'global',
  },
  europe: {
    // Widened slightly from the lon -12 the brief suggested: Iceland runs from
    // -24.5 to -13.5, so -12 would have left it entirely out of frame. At -20
    // it is cropped at the west edge, which is the intended reading, and the
    // box also fills the 16:9 frame instead of leaving dead space at the sides.
    viewport: {lonMin: -20, lonMax: 42, latMin: 34, latMax: 71},
    fit: {maxWidth: 0.85, maxHeight: 0.84, offsetY: 0},
    // A regional box at the global pitch would be far too coarse for the
    // coastline, which is what makes the region readable.
    dotPitch: 11,
    dotSize: 5,
    arcCount: 6,
    // Substantially shallower than the global variant: that bow factor is
    // calibrated to intercontinental distances and would put absurd loops on
    // these much shorter hops.
    bowFactor: 0.11,
    bowMin: 45,
    bowMax: 320,
    arcWidth: 3,
    minArcLength: 900,
    points: EUROPE_POINTS,
    routes: EUROPE_ROUTES,
    pulseRadius: 40,
    travellerRadius: 4,
    seed: 'europe',
  },
} satisfies Record<string, VariantConfig>;

export type VariantName = keyof typeof VARIANTS;

export const getVariant = (variant: VariantName): VariantConfig =>
  VARIANTS[variant];

/** Frame geometry and loop length, shared by every variant. */
export const FRAME_WIDTH = 3840;
export const FRAME_HEIGHT = 2160;
export const LOOP_FRAMES = 600;
export const FPS = 30;
