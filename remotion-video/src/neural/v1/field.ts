/**
 * Layout for V1, "Abstract AI neural network".
 *
 * A bundle is a bright node with strands rooted at it. The strands leave the
 * node as a fan and then *straighten out*: each one approaches its own
 * horizontal line and runs roughly parallel to its neighbours from there on.
 * That saturating fan is the shape the reference is built from -- strands
 * that kept spreading radially would read as a starburst, which is not what
 * the footage does.
 *
 * Density is driven by per-bundle entry times rather than by how far the
 * camera travels, so the drift can stay slow while the frame still fills up.
 */

import { mulberry32 } from "../core/noise";

export const V1_FPS = 30;
export const V1_DURATION_IN_FRAMES = 450;

/** Depth slices, each rendered to its own canvas and blurred separately. */
export type BandId = 0 | 1 | 2;
export const BANDS: readonly BandId[] = [0, 1, 2];

type BandSpec = {
  zMin: number;
  zMax: number;
  ySpread: number;
  weight: number;
  widthScale: number;
  brightness: number;
};

const BAND_SPECS: Record<BandId, BandSpec> = {
  0: { zMin: -24, zMax: -13, ySpread: 14, weight: 0.34, widthScale: 1.2, brightness: 0.52 },
  1: { zMin: -5, zMax: 3, ySpread: 8, weight: 0.46, widthScale: 1.0, brightness: 1.0 },
  2: { zMin: 8, zMax: 13, ySpread: 5, weight: 0.2, widthScale: 0.8, brightness: 0.34 },
};

export type Bundle = {
  /** The node the strands are rooted at. */
  x: number;
  y: number;
  z: number;
  band: BandId;
  /** +1 fans to the right, -1 to the left. */
  dir: 1 | -1;
  /** How far the strands reach from the node. */
  length: number;
  /** Distance over which the fan flattens out; small = a tight sharp node. */
  falloff: number;
  /** Half-height the fan settles to once it has straightened. */
  spread: number;
  strandCount: number;
  brightness: number;
  flareWarmth: number;
  entryTime: number;
  seed: number;
  strandOffset: number;
};

export type Strand = {
  bundle: number;
  /** Where this strand settles across the fan, -1..1. */
  offset: number;
  /** Depth spread, so a fan has thickness rather than being a flat sheet. */
  zOffset: number;
  /** Multiplies the bundle's fan-opening distance. */
  falloffScale: number;
  lengthScale: number;
  widthScale: number;
  /** 0 = deep blue background strand, 1 = bright core strand. */
  tone: number;
  wanderSeed: number;
  dim: number;
};

export type BandData = {
  band: BandId;
  bundles: Bundle[];
  strands: Strand[];
};

const CAMERA_START_X = 0;
const CAMERA_SPEED_X = 2.0;
export const V1_FIELD_X_MIN = -26;
export const V1_FIELD_X_MAX = 60;

const BUNDLE_COUNT = 18;

export const v1Camera = (seconds: number) => {
  const x = CAMERA_START_X + seconds * CAMERA_SPEED_X;
  return {
    x,
    y: Math.sin(seconds * 0.27) * 1.1 + seconds * 0.06,
    z: 26 - seconds * 0.2,
    lookX: x + Math.sin(seconds * 0.19) * 2.2,
    lookY: Math.sin(seconds * 0.23 + 1.1) * 0.6,
  };
};

export const buildV1Field = (): Record<BandId, BandData> => {
  const rnd = mulberry32(0x5eed01);

  const bandOrder: BandId[] = [];
  for (const band of BANDS) {
    const count = Math.round(BUNDLE_COUNT * BAND_SPECS[band].weight);
    for (let i = 0; i < count; i++) {
      bandOrder.push(band);
    }
  }
  for (let i = bandOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bandOrder[i], bandOrder[j]] = [bandOrder[j], bandOrder[i]];
  }

  const span = V1_FIELD_X_MAX - V1_FIELD_X_MIN;
  const step = span / bandOrder.length;

  const all: Bundle[] = bandOrder.map((band, i) => {
    const spec = BAND_SPECS[band];
    return {
      x: V1_FIELD_X_MIN + step * (i + 0.5) + (rnd() - 0.5) * step * 1.3,
      y: (rnd() - 0.5) * 2 * spec.ySpread,
      z: spec.zMin + rnd() * (spec.zMax - spec.zMin),
      band,
      dir: rnd() > 0.5 ? 1 : -1,
      // Long enough to cross the frame: the reference strands run off the
      // edge rather than terminating inside it.
      length: 46 + rnd() * 26,
      // The fan opens over roughly a third of the strand's travel. Opening
      // much faster than this turns the bundle into a hard wedge; the
      // reference eases open over a long sweep.
      falloff: 13 + rnd() * 8,
      spread: 5.5 + rnd() * 5,
      strandCount: 12 + Math.floor(rnd() * 8),
      brightness: spec.brightness * (0.8 + rnd() * 0.45),
      flareWarmth: rnd() < 0.3 ? 0.55 + rnd() * 0.45 : 0,
      entryTime: 0,
      seed: Math.floor(rnd() * 1e6),
      strandOffset: 0,
    };
  });

  // Entry order: whichever bundle sits nearest the centre of frame a second
  // in goes first and holds the screen alone, as the reference opens.
  const opening = v1Camera(1);
  const cost = (b: Bundle) =>
    Math.abs(b.x - opening.x) + Math.abs(b.y) * 0.6 + Math.abs(b.z + 1) * 0.5;

  const order = all.map((_, i) => i);
  const first = order.reduce((best, i) => (cost(all[i]) < cost(all[best]) ? i : best), 0);
  const rest = order.filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  [first, ...rest].forEach((bundleIndex, rank, seq) => {
    const p = rank / (seq.length - 1);
    all[bundleIndex].entryTime = rank === 0 ? 0.3 : 1.1 + Math.pow(p, 0.75) * 9.4;
  });

  const result = {} as Record<BandId, BandData>;

  for (const band of BANDS) {
    const bundles = all.filter((b) => b.band === band);
    const strands: Strand[] = [];

    for (let bi = 0; bi < bundles.length; bi++) {
      const bundle = bundles[bi];
      bundle.strandOffset = strands.length;
      const spec = BAND_SPECS[band];

      for (let s = 0; s < bundle.strandCount; s++) {
        // Spread the settled offsets unevenly: evenly spaced strands look
        // mechanical, and the reference clearly bunches some together.
        const even = (s / (bundle.strandCount - 1)) * 2 - 1;
        strands.push({
          bundle: bi,
          offset: even + (rnd() - 0.5) * 0.38,
          zOffset: (rnd() - 0.5) * 1.4,
          // Per-strand variation in how fast the fan opens: a single shared
          // rate gives the bundle a hard triangular silhouette.
          falloffScale: 0.65 + rnd() * 0.8,
          lengthScale: 0.45 + rnd() * 0.8,
          widthScale: spec.widthScale * (0.75 + rnd() * 0.6),
          tone: Math.pow(rnd(), 1.5),
          wanderSeed: rnd() * 500,
          dim: 0.6 + rnd() * 0.6,
        });
      }
    }

    result[band] = { band, bundles, strands };
  }

  return result;
};
