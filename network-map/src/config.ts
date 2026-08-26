import {THEMES} from './theme';

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
/**
   * How far inside the projected map box an arc's endpoints must sit, in frame
   * pixels. An endpoint closer than this to an edge is rejected outright, so no
   * line ever begins or ends on the edge of the map.
   */
  endpointMargin: number;
  /**
   * How far inside the map box the curves themselves must stay. Smaller than
   * the endpoint margin on purpose: a long route's apex needs the room to keep
   * a graceful bow, and it only has to avoid running along the boundary, not
   * terminate clear of it.
   */
  curveMargin: number;
  /** The two background blues this variant paints. */
  background: {deep: string; glow: string};
  /** Radius a completed-arc node pulse expands to, in frame pixels. */
  pulseRadius: number;
  /** Radius of a travelling dot, in frame pixels. */
  travellerRadius: number;
  /** Seed prefix, so the two variants never share a random stream. */
  seed: string;
  /**
   * Optional 3D tilt applied to the map plane as a whole. Presentation only:
   * the dot map, the arcs and their bounds are all still generated flat, in the
   * same coordinates, and the tilt is a perspective transform over the top.
   */
  tilt?: Tilt;
};

/**
 * Lays the map back like a surface seen from above and in front. Positive
 * `angleDeg` tips the top edge away from the viewer and brings the bottom edge
 * toward it, which draws the top edge down and the bottom edge up.
 */
export type Tilt = {
  angleDeg: number;
  /** Viewing distance in frame pixels. Smaller is a more extreme perspective. */
  perspective: number;
  /** Uniform scale applied after the rotation, to refill the frame. */
  scale: number;
  /** Vertical nudge in frame pixels, applied after the rotation. */
  offsetY: number;
  /**
   * Slow push-in, as a fraction of `scale`. The zoom eases in over the first
   * half of the loop and back out over the second, so it closes at frame 600
   * with no velocity discontinuity - a one-way push could not loop.
   */
  zoom: number;
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
// 1440 / 1240 / 1110 px, so the arcs read as differently sized rather than as one
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
  {from: 'sydney', to: 'nairobi'},
];


const GLOBAL_VARIANT: VariantConfig = {
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
  endpointMargin: 150,
  curveMargin: 40,
  background: {deep: THEMES.backgroundDeep, glow: THEMES.backgroundGlow},
  points: GLOBAL_POINTS,
  routes: GLOBAL_ROUTES,
  pulseRadius: 46,
  travellerRadius: 4.5,
  seed: 'global',
};

export const VARIANTS = {
  global: GLOBAL_VARIANT,
  /**
   * Version two is version one's map seen from about 45 degrees, as though the
   * plane were laid back on a table. Everything else - the dot set, the six
   * routes, the colours, the timing, the seed - is the same, so the two
   * compositions differ only in how the finished plane is presented.
   */
  globalTilted: {
    ...GLOBAL_VARIANT,
    // A cooler blue than version one, so the two read as separate pieces.
    background: {
      deep: THEMES.backgroundDeepCool,
      glow: THEMES.backgroundGlowCool,
    },
    // The base scale is set so that base x (1 + zoom) stays at the 1.2 where
    // the near edge of the plane still fits inside the frame.
    tilt: {angleDeg: 45, perspective: 3400, scale: 1.13, offsetY: 0, zoom: 0.06},
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
