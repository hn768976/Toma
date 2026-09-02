import type { SilhouetteBand } from "../lib/SvgSilhouetteField";

export type BandName = "far" | "mid" | "near" | "foreground";

export type ForestBand = SilhouetteBand & {
  /** Position on the tint ramp used to fill this band's ground ridge. */
  ridgeTint: number;
};

// Back to front. Only the near band is sharp and full-resolution; the other
// three are heavily blurred, so rendering them at half resolution and letting
// the browser upscale costs nothing visually and roughly quarters both their
// memory and their blur cost.
export const BANDS: Record<BandName, ForestBand> = {
  far: {
    count: 40,
    baseHeightFrac: 0.19,
    scaleMin: 0.45,
    scaleMax: 1.5,
    scaleBias: 1.7,
    baseYFrac: 0.63,
    baseYJitter: 0.022,
    blur: 18,
    opacityMin: 0.5,
    opacityMax: 0.78,
    depthMin: 0.72,
    depthMax: 0.92,
    resolution: 0.5,
    shearDeg: 5,
    rotateDeg: 4,
    squashMin: 0.84,
    squashMax: 1.3,
    ridge: { yFrac: 0.66, wobbleFrac: 0.05 },
    ridgeTint: 0.86,
  },
  mid: {
    count: 26,
    baseHeightFrac: 0.26,
    scaleMin: 0.45,
    scaleMax: 1.5,
    scaleBias: 1.7,
    baseYFrac: 0.735,
    baseYJitter: 0.026,
    blur: 7,
    opacityMin: 0.82,
    opacityMax: 1,
    depthMin: 0.38,
    depthMax: 0.68,
    resolution: 0.5,
    shearDeg: 5,
    rotateDeg: 4,
    squashMin: 0.84,
    squashMax: 1.3,
    ridge: { yFrac: 0.79, wobbleFrac: 0.045 },
    ridgeTint: 0.5,
  },
  near: {
    count: 14,
    baseHeightFrac: 0.36,
    scaleMin: 0.45,
    scaleMax: 1.5,
    scaleBias: 1.7,
    baseYFrac: 0.905,
    baseYJitter: 0.03,
    blur: 0,
    opacityMin: 1,
    opacityMax: 1,
    depthMin: 0.06,
    depthMax: 0.26,
    resolution: 1,
    shearDeg: 5,
    rotateDeg: 4,
    squashMin: 0.84,
    squashMax: 1.3,
    ridge: { yFrac: 0.945, wobbleFrac: 0.024 },
    ridgeTint: 0.05,
  },
  foreground: {
    count: 4,
    baseHeightFrac: 0.72,
    scaleMin: 0.85,
    scaleMax: 1.3,
    scaleBias: 1.15,
    baseYFrac: 1.15,
    baseYJitter: 0.05,
    blur: 26,
    opacityMin: 1,
    opacityMax: 1,
    depthMin: 0,
    depthMax: 0.05,
    resolution: 0.5,
    shearDeg: 5,
    rotateDeg: 4,
    squashMin: 0.84,
    squashMax: 1.3,
    edgeHugging: true,
    ridge: null,
    ridgeTint: 0,
  },
};

export const BAND_ORDER: BandName[] = ["far", "mid", "near", "foreground"];
