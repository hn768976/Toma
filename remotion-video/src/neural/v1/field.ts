/**
 * Layout for V1, "Abstract AI neural network".
 *
 * The field is a static arrangement of fibre *bundles* -- a bundle being a
 * pinch point that a few dozen strands converge on and fan out from. The
 * camera drifts slowly along +X through the field.
 *
 * Density is driven by per-bundle entry times rather than by how far the
 * camera travels. Getting the sparse-to-dense ramp out of camera speed alone
 * would need a much faster push than the reference has, so instead the whole
 * field is laid out up front and bundles fade in over the 15 seconds. That
 * keeps the drift slow and cinematic while still ending crowded.
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
  /** Share of bundles allocated to this slice. */
  weight: number;
  widthScale: number;
  brightness: number;
};

const BAND_SPECS: Record<BandId, BandSpec> = {
  0: { zMin: -27, zMax: -14, ySpread: 15, weight: 0.38, widthScale: 1.05, brightness: 0.42 },
  1: { zMin: -6, zMax: 2.5, ySpread: 8.5, weight: 0.44, widthScale: 1.0, brightness: 1.0 },
  2: { zMin: 8, zMax: 14.5, ySpread: 5.2, weight: 0.18, widthScale: 0.55, brightness: 0.26 },
};

export type Bundle = {
  x: number;
  y: number;
  z: number;
  band: BandId;
  strandCount: number;
  /** Half-length of the bundle along its own axis. */
  length: number;
  /** Rotation of the bundle axis within the XY plane, in radians. */
  angle: number;
  spreadLeft: number;
  spreadRight: number;
  seed: number;
  brightness: number;
  /** 0 = cool white node flare, 1 = fully warm amber. */
  flareWarmth: number;
  /** Seconds at which this bundle starts fading in. */
  entryTime: number;
  /** Index into the band's strand array. */
  strandOffset: number;
};

export type Strand = {
  bundle: number;
  /**
   * Position of this strand's branch within the fan, -1..1. Branches separate
   * from the pinch first; strands only separate from their branch further
   * out, which is what produces the tree-like silhouette.
   */
  branch: number;
  /** Position of this strand within its branch, -1..1. */
  withinBranch: number;
  branchWidth: number;
  zJitter: number;
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
const CAMERA_SPEED_X = 2.2;
export const V1_FIELD_X_MIN = -24;
export const V1_FIELD_X_MAX = 58;

const BUNDLE_COUNT = 34;

/** Camera pose for a given time in seconds. Pure, so frames stay independent. */
export const v1Camera = (seconds: number) => {
  const x = CAMERA_START_X + seconds * CAMERA_SPEED_X;
  return {
    x,
    y: Math.sin(seconds * 0.27) * 1.15 + seconds * 0.075,
    z: 26 - seconds * 0.22,
    // A touch of look-ahead keeps the drift from reading as a flat pan.
    lookX: x + Math.sin(seconds * 0.19) * 2.4,
    lookY: Math.sin(seconds * 0.23 + 1.1) * 0.7,
  };
};

export const buildV1Field = (): Record<BandId, BandData> => {
  const rnd = mulberry32(0x5eed01);

  // Deal bundles into depth slices, then space them along the flow axis with
  // jitter so the field never looks like a grid.
  const bands: BandId[] = [];
  for (const band of BANDS) {
    const count = Math.round(BUNDLE_COUNT * BAND_SPECS[band].weight);
    for (let i = 0; i < count; i++) {
      bands.push(band);
    }
  }
  // Fisher-Yates with the seeded PRNG so the interleaving is reproducible.
  for (let i = bands.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bands[i], bands[j]] = [bands[j], bands[i]];
  }

  const span = V1_FIELD_X_MAX - V1_FIELD_X_MIN;
  const step = span / bands.length;

  const all: Bundle[] = bands.map((band, i) => {
    const spec = BAND_SPECS[band];
    const x = V1_FIELD_X_MIN + step * (i + 0.5) + (rnd() - 0.5) * step * 1.35;
    // One side of a bundle stays tight while the other fans wide; that
    // asymmetry is the most recognisable feature of the reference.
    const wideRight = rnd() > 0.45;
    const tight = 0.16 + rnd() * 0.22;
    const wide = 0.85 + rnd() * 0.5;

    return {
      x,
      y: (rnd() - 0.5) * 2 * spec.ySpread,
      z: spec.zMin + rnd() * (spec.zMax - spec.zMin),
      band,
      strandCount: 10 + Math.floor(rnd() * 9),
      length: 9 + rnd() * 7,
      // Fans point in a range of directions rather than all lying flat along
      // the flow axis, which is what stops the field reading as stripes.
      angle: (rnd() - 0.5) * 0.85,
      spreadLeft: wideRight ? tight : wide,
      spreadRight: wideRight ? wide : tight,
      seed: Math.floor(rnd() * 1e6),
      brightness: spec.brightness * (0.75 + rnd() * 0.5),
      // A minority of nodes glow warm, which is where the reference gets its
      // amber counterpoint to all the blue.
      flareWarmth: rnd() < 0.3 ? 0.55 + rnd() * 0.45 : 0,
      entryTime: 0,
      strandOffset: 0,
    };
  });

  // Entry order: whichever bundle sits nearest the centre of frame a second
  // in goes first and holds the screen alone, exactly as the reference opens.
  const opening = v1Camera(1);
  const cost = (b: Bundle) =>
    Math.abs(b.x - opening.x) * 1.0 + Math.abs(b.y) * 0.6 + Math.abs(b.z + 2) * 0.5;

  const order = all.map((_, i) => i);
  const firstIndex = order.reduce((best, i) => (cost(all[i]) < cost(all[best]) ? i : best), 0);
  const rest = order.filter((i) => i !== firstIndex);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  const sequence = [firstIndex, ...rest];
  sequence.forEach((bundleIndex, rank) => {
    const p = rank / (sequence.length - 1);
    all[bundleIndex].entryTime = rank === 0 ? 0.3 : 1.2 + Math.pow(p, 0.72) * 9.2;
  });

  const result = {} as Record<BandId, BandData>;

  for (const band of BANDS) {
    const bundles = all.filter((b) => b.band === band);
    const strands: Strand[] = [];

    for (let bi = 0; bi < bundles.length; bi++) {
      const bundle = bundles[bi];
      bundle.strandOffset = strands.length;
      const spec = BAND_SPECS[band];

      // Deal the bundle's strands into a handful of branches.
      const branchCount = 3 + Math.floor(rnd() * 3);
      const branchCentre: number[] = [];
      const branchWidth: number[] = [];
      for (let k = 0; k < branchCount; k++) {
        branchCentre.push(
          (k / Math.max(1, branchCount - 1)) * 2 - 1 + (rnd() - 0.5) * 0.3,
        );
        branchWidth.push(0.18 + rnd() * 0.3);
      }

      for (let s = 0; s < bundle.strandCount; s++) {
        const k = Math.floor((s / bundle.strandCount) * branchCount);
        const inBranch = bundle.strandCount / branchCount;
        const local = ((s % inBranch) / Math.max(1, inBranch - 1)) * 2 - 1;

        strands.push({
          bundle: bi,
          branch: branchCentre[k] + (rnd() - 0.5) * 0.08,
          withinBranch: local + (rnd() - 0.5) * 0.25,
          branchWidth: branchWidth[k],
          zJitter: (rnd() - 0.5) * 2,
          lengthScale: 0.68 + rnd() * 0.55,
          widthScale: spec.widthScale * (0.7 + rnd() * 0.8),
          // A minority of bright strands reads as the bundle's lit core.
          tone: Math.pow(rnd(), 2.2),
          wanderSeed: rnd() * 500,
          dim: 0.5 + rnd() * 0.7,
        });
      }
    }

    result[band] = { band, bundles, strands };
  }

  return result;
};
