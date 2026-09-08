/**
 * The dot matrix. The land mask is sampled once, here at module level, into a
 * flat typed-array of dots; nothing is re-sampled per frame.
 */
import {
  DOT_STEP,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAP_X,
  MAP_Y,
} from "./constants";
import { landCoverage } from "./land-mask";
import { LAT_PER_PX, LON_PER_PX, xToLon, yToLat } from "./projection";
import { makeFbm2D, mulberry32 } from "./random";

export type DotField = {
  /** Flat-pixel centre of each dot. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly radius: Float32Array;
  /** Base brightness, 0..1. */
  readonly brightness: Float32Array;
  /** Shimmer amplitude and phase; amplitude is 0 for most dots. */
  readonly shimmerAmp: Float32Array;
  readonly shimmerPhase: Float32Array;
  readonly shimmerSpeed: Float32Array;
  /** 1 for the bright white-cyan accents that also get a glow sprite. */
  readonly accent: Uint8Array;
  readonly count: number;
};

export type HotSpot = {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly strength: number;
};

const SEED = 0x5eed1a;

const buildDotField = (): { field: DotField; hotSpots: HotSpot[] } => {
  const rng = mulberry32(SEED);
  const activity = makeFbm2D(SEED + 101);
  const jitter = makeFbm2D(SEED + 202);

  const cols = Math.floor(MAP_WIDTH / DOT_STEP);
  const rows = Math.floor(MAP_HEIGHT / DOT_STEP);
  const capacity = cols * rows;

  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const radius = new Float32Array(capacity);
  const brightness = new Float32Array(capacity);
  const shimmerAmp = new Float32Array(capacity);
  const shimmerPhase = new Float32Array(capacity);
  const shimmerSpeed = new Float32Array(capacity);
  const accent = new Uint8Array(capacity);

  // Candidate glow centres: the densest cells, thinned so they do not clump.
  const candidates: HotSpot[] = [];

  let n = 0;
  for (let row = 0; row < rows; row++) {
    const py = MAP_Y + (row + 0.5) * DOT_STEP;
    const lat = yToLat(py);
    for (let col = 0; col < cols; col++) {
      const px = MAP_X + (col + 0.5) * DOT_STEP;
      const lon = xToLon(px);

      const coverage = landCoverage(
        lon,
        lat,
        LON_PER_PX * DOT_STEP,
        LAT_PER_PX * DOT_STEP,
      );
      if (coverage < 0.38) continue;

      // Low-frequency field: a few regions read as concentrations of activity.
      const a = Math.min(
        1,
        Math.max(0, (activity(lon / 34 + 40, lat / 22 + 40) - 0.3) / 0.42),
      );

      // Density thins out where activity is low.
      const r0 = rng();
      if (r0 > 0.6 + 0.4 * a) continue;

      const local = jitter(lon / 3.5 + 90, lat / 3.5 + 90);
      const edge = Math.min(1, coverage * 1.35);

      x[n] = px;
      y[n] = py;
      brightness[n] =
        (0.34 + 0.34 * a + 0.26 * local + 0.1 * rng()) * (0.55 + 0.45 * edge);
      radius[n] = 1.05 + 0.5 * a + 0.45 * rng();

      const isAccent = rng() < 0.018 + 0.14 * a * a;
      accent[n] = isAccent ? 1 : 0;
      if (isAccent) {
        brightness[n] = Math.min(1.35, brightness[n] * 1.55 + 0.25);
        radius[n] += 0.5;
      }

      if (rng() < 0.14) {
        shimmerAmp[n] = 0.16 + 0.42 * rng();
        shimmerPhase[n] = rng() * Math.PI * 2;
        shimmerSpeed[n] = 0.035 + 0.09 * rng();
      }

      if (a > 0.86 && rng() < 0.02) {
        candidates.push({
          x: px,
          y: py,
          radius: 220 + rng() * 260,
          strength: 0.3 + 0.35 * rng(),
        });
      }

      n++;
    }
  }

  // Thin the glow centres so they read as a handful of regions, not a spray.
  const hotSpots: HotSpot[] = [];
  for (const c of candidates) {
    if (hotSpots.length >= 7) break;
    const tooClose = hotSpots.some(
      (h) => Math.hypot(h.x - c.x, h.y - c.y) < 620,
    );
    if (!tooClose) hotSpots.push(c);
  }

  return {
    field: {
      x: x.subarray(0, n),
      y: y.subarray(0, n),
      radius: radius.subarray(0, n),
      brightness: brightness.subarray(0, n),
      shimmerAmp: shimmerAmp.subarray(0, n),
      shimmerPhase: shimmerPhase.subarray(0, n),
      shimmerSpeed: shimmerSpeed.subarray(0, n),
      accent: accent.subarray(0, n),
      count: n,
    },
    hotSpots,
  };
};

const built = buildDotField();

export const DOTS: DotField = built.field;
export const HOT_SPOTS: readonly HotSpot[] = built.hotSpots;
