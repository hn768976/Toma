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
  /** Share of arcs coloured [cyan, red, violet]. Must sum to 1. */
  colorMix: [number, number, number];
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

const GLOBAL_ROUTES: Route[] = [
  {from: 'newYork', to: 'london'},
  {from: 'losAngeles', to: 'tokyo'},
  {from: 'london', to: 'singapore'},
  {from: 'saoPaulo', to: 'lagos'},
  {from: 'newYork', to: 'saoPaulo'},
  {from: 'dubai', to: 'london'},
  {from: 'shanghai', to: 'losAngeles'},
  {from: 'paris', to: 'delhi'},
  {from: 'johannesburg', to: 'dubai'},
  {from: 'sydney', to: 'singapore'},
  {from: 'moscow', to: 'beijing'},
  {from: 'chicago', to: 'madrid'},
  {from: 'hongKong', to: 'sydney'},
  {from: 'cairo', to: 'mumbai'},
  {from: 'vancouver', to: 'seoul'},
  {from: 'buenosAires', to: 'casablanca'},
  {from: 'nairobi', to: 'istanbul'},
  {from: 'toronto', to: 'reykjavik'},
  {from: 'mexicoCity', to: 'bogota'},
  {from: 'tokyo', to: 'jakarta'},
  {from: 'auckland', to: 'hongKong'},
  {from: 'lima', to: 'newYork'},
  {from: 'bangkok', to: 'tehran'},
  {from: 'losAngeles', to: 'bogota'},
  {from: 'moscow', to: 'mumbai'},
];


export const VARIANTS = {
  global: {
    // Antarctica is deliberately outside the box: it adds nothing and drags
    // the visual mass to the bottom of the frame.
    viewport: {lonMin: -170, lonMax: 180, latMin: -60, latMax: 78},
    fit: {maxWidth: 0.85, maxHeight: 0.78, offsetY: 20},
    dotPitch: 14,
    dotSize: 7,
    arcCount: 22,
    bowFactor: 0.22,
    bowMin: 70,
    bowMax: 620,
    arcWidth: 3,
    colorMix: [0.5, 0.35, 0.15],
    points: GLOBAL_POINTS,
    routes: GLOBAL_ROUTES,
    pulseRadius: 46,
    travellerRadius: 4.5,
    seed: 'global',
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
