import { TINT_STEPS } from "./constants";
import { clamp, lerp, rndBool, rndInt, rndRange, wrap } from "./rand";

export type BandName = "far" | "mid" | "near" | "foreground";

export type BandConfig = {
  count: number;
  /** Tree height at scale 1.0, as a fraction of frame height. */
  baseHeightFrac: number;
  scaleMin: number;
  scaleMax: number;
  /** Where the trunk bases sit, as a fraction of frame height. */
  baseYFrac: number;
  baseYJitter: number;
  /** Blur radius in 4K pixels, applied ONCE to the whole band. */
  blur: number;
  opacityMin: number;
  opacityMax: number;
  /** Slice of the global 0..1 depth ramp this band occupies. */
  depthMin: number;
  depthMax: number;
  /**
   * Confines instances to the outer edges of the frame. Only the foreground
   * band uses it: four huge trees spread evenly would wall the frame off,
   * whereas four pressed against the left and right edges frame it.
   */
  edgeHugging?: boolean;
  /** Backing-store scale for this band's canvas, 1 = full 3840x2160. */
  resolution: number;
  /** Horizontal shear range, in degrees. */
  shearDeg: number;
  /** Exponent on the scale distribution; >1 biases toward small instances. */
  scaleBias: number;
  /** Extra rotation range, in degrees. */
  rotateDeg: number;
  /**
   * A soft irregular ground ridge is filled from here down to the bottom of
   * the band, hiding the flat cut where the source SVG's trunk ends and
   * establishing ground recession. Null = no ridge (the foreground band's
   * bases are already well below the frame).
   */
  ridgeYFrac: number | null;
  /** Amplitude of the wobble on the ridge, as a fraction of frame height. */
  ridgeWobble: number;
  ridgeTint: number;
};

// Back to front. Only the near band is sharp and full-resolution; the other
// three are heavily blurred, so rendering them at half resolution and letting
// the browser upscale costs nothing visually and roughly quarters both their
// memory and their blur cost.
export const BANDS: Record<BandName, BandConfig> = {
  far: {
    count: 40,
    baseHeightFrac: 0.19,
    scaleMin: 0.45,
    scaleMax: 1.5,
    baseYFrac: 0.63,
    baseYJitter: 0.022,
    blur: 18,
    opacityMin: 0.5,
    opacityMax: 0.78,
    depthMin: 0.72,
    depthMax: 0.92,
    resolution: 0.5,
    shearDeg: 5,
    scaleBias: 1.7,
    rotateDeg: 4,
    ridgeYFrac: 0.66,
    ridgeWobble: 0.05,
    ridgeTint: 0.86,
  },
  mid: {
    count: 26,
    baseHeightFrac: 0.26,
    scaleMin: 0.45,
    scaleMax: 1.5,
    baseYFrac: 0.735,
    baseYJitter: 0.026,
    blur: 7,
    opacityMin: 0.82,
    opacityMax: 1,
    depthMin: 0.38,
    depthMax: 0.68,
    resolution: 0.5,
    shearDeg: 5,
    scaleBias: 1.7,
    rotateDeg: 4,
    ridgeYFrac: 0.79,
    ridgeWobble: 0.045,
    ridgeTint: 0.5,
  },
  near: {
    count: 14,
    baseHeightFrac: 0.36,
    scaleMin: 0.45,
    scaleMax: 1.5,
    baseYFrac: 0.905,
    baseYJitter: 0.03,
    blur: 0,
    opacityMin: 1,
    opacityMax: 1,
    depthMin: 0.06,
    depthMax: 0.26,
    resolution: 1,
    shearDeg: 5,
    scaleBias: 1.7,
    rotateDeg: 4,
    ridgeYFrac: 0.945,
    ridgeWobble: 0.024,
    ridgeTint: 0.05,
  },
  foreground: {
    count: 4,
    baseHeightFrac: 0.72,
    scaleMin: 0.85,
    scaleMax: 1.3,
    baseYFrac: 1.15,
    baseYJitter: 0.05,
    blur: 26,
    opacityMin: 1,
    opacityMax: 1,
    depthMin: 0,
    depthMax: 0.05,
    edgeHugging: true,
    resolution: 0.5,
    shearDeg: 5,
    scaleBias: 1.15,
    rotateDeg: 4,
    ridgeYFrac: null,
    ridgeWobble: 0,
    ridgeTint: 0,
  },
};

export const BAND_ORDER: BandName[] = ["far", "mid", "near", "foreground"];

export type TreeInstance = {
  /** Trunk base, in 4K frame pixels. May sit outside the frame. */
  x: number;
  y: number;
  height: number;
  flip: boolean;
  /** Radians. */
  shear: number;
  rotate: number;
  /** Non-uniform stretch, so two same-scale instances still differ. */
  squash: number;
  opacity: number;
  /** Index into the pre-tinted sprite array. */
  tint: number;
};

/**
 * Builds one depth band's worth of trees. Pure, seeded and deterministic:
 * called once from a useMemo, never per frame.
 *
 * Horizontal placement is stratified (one tree per equal slice of an
 * over-wide range, jittered inside its slice) rather than uniformly random,
 * which avoids the clumps-and-gaps a plain random spread produces at these
 * counts. The range runs from -12% to 112% of the width so instances are
 * genuinely cropped by both frame edges.
 */
export const buildBand = (
  band: BandName,
  width: number,
  height: number,
  seedPrefix: string,
): TreeInstance[] => {
  const cfg = BANDS[band];
  const spanStart = -0.12 * width;
  const spanEnd = 1.12 * width;
  const slice = (spanEnd - spanStart) / cfg.count;

  const trees = new Array(cfg.count).fill(0).map((_, i) => {
    const s = `${seedPrefix}-${band}-${i}`;
    // Scale comes from a golden-ratio low-discrepancy sequence over the band
    // index, jittered, rather than from a plain random draw. A random draw
    // regularly puts two same-size instances side by side, and two same-size
    // instances of ONE source silhouette — one of them flipped — read
    // immediately as a mirrored stamp. Spreading scale across neighbours is
    // the single most effective thing against that.
    const scaleT = wrap(i * 0.6180339887 + rndRange(`${s}-scale`, 0, 0.22), 1);
    const scale = lerp(
      cfg.scaleMin,
      cfg.scaleMax,
      Math.pow(scaleT, cfg.scaleBias),
    );
    const squash = rndRange(`${s}-squash`, 0.84, 1.3);
    // Depth within the band tracks size: the biggest instances read as the
    // nearest ones, so they get the darkest tint and the most opacity.
    const depthLocal = clamp(
      1 - (scale - cfg.scaleMin) / (cfg.scaleMax - cfg.scaleMin),
      0,
      1,
    );
    const depth = lerp(cfg.depthMin, cfg.depthMax, depthLocal);

    return {
      x: cfg.edgeHugging
        ? width *
          (i % 2 === 0
            ? rndRange(`${s}-x`, -0.1, 0.13)
            : rndRange(`${s}-x`, 0.87, 1.1))
        : spanStart + slice * (i + rndRange(`${s}-x`, 0.05, 0.95)),
      y: height * (cfg.baseYFrac + rndRange(`${s}-y`, -1, 1) * cfg.baseYJitter),
      height: height * cfg.baseHeightFrac * scale * squash,
      flip: rndBool(`${s}-flip`),
      shear: (rndRange(`${s}-shear`, -1, 1) * cfg.shearDeg * Math.PI) / 180,
      rotate: (rndRange(`${s}-rot`, -1, 1) * cfg.rotateDeg * Math.PI) / 180,
      squash,
      opacity: lerp(cfg.opacityMax, cfg.opacityMin, depthLocal),
      tint: clamp(Math.round(depth * (TINT_STEPS - 1)), 0, TINT_STEPS - 1),
    };
  });

  // Draw the smallest (most distant) first so the largest sit on top.
  return trees.sort((a, b) => a.height - b.height);
};

export type RidgeProfile = { amp: number; period: number; phase: number }[];

/** A static, seeded sum-of-sines used for the irregular ground-ridge edge. */
export const buildRidge = (seed: string, layers = 4): RidgeProfile =>
  new Array(layers).fill(0).map((_, i) => ({
    amp: rndRange(`${seed}-amp-${i}`, 0.35, 1) / (i + 1),
    period: rndInt(`${seed}-period-${i}`, 1, 3) + i * 2,
    phase: rndRange(`${seed}-phase-${i}`, 0, Math.PI * 2),
  }));

/** Evaluates a ridge profile at horizontal position `u` (0..1). Returns -1..1. */
export const ridgeAt = (profile: RidgeProfile, u: number) => {
  let sum = 0;
  let norm = 0;
  for (const layer of profile) {
    sum += layer.amp * Math.sin(u * Math.PI * 2 * layer.period + layer.phase);
    norm += layer.amp;
  }
  return norm === 0 ? 0 : sum / norm;
};
