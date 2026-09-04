import {
  EDGE_FLOOR,
  EDGE_FRACTION,
  HIGHLIGHT_POSITION,
  LENS_POWER,
  RIB_COUNT,
  RIB_GAP,
  SPEC_FRACTION,
  SPEC_GAIN,
  SPEC_HALO_SCALE,
  SPEC_HALO_WEIGHT,
} from "./constants";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Remapping exponent that slides the peak of sin(PI * v) from the middle of
// the face onto HIGHLIGHT_POSITION, stretching the approach to the highlight
// and compressing the fall away from it.
const PEAK_GAMMA = Math.log(0.5) / Math.log(HIGHLIGHT_POSITION);

/**
 * Cross-section of one rib face, for v in [0, 1] across the lit face:
 * zero at both edges, brightest just past centre, like light off a convex
 * lens. Continuous, so it can be sampled at any resolution without aliasing.
 */
const faceShade = (v: number) =>
  Math.pow(Math.sin(Math.PI * Math.pow(v, PEAK_GAMMA)), LENS_POWER);

export type RibProfile = {
  /** Lens shading + rib edges + specular, one value per pixel column. */
  shading: Float32Array;
  /** Specular core only, for the extra additive pass. */
  hot: Float32Array;
  ribWidth: number;
};

// Sub-pixel samples per column. The rib edge and the specular line are only
// a couple of pixels wide at 4K; box-filtering them here is what stops them
// shimmering or moireing when the frame is scaled.
const SUB_SAMPLES = 4;

/**
 * The rib pattern is a continuous function of x evaluated per pixel column -
 * never a set of drawn rectangles - and it does not depend on time: the ribs
 * are fixed geometry, all the motion is light moving behind them.
 */
export const buildRibProfile = (width: number): RibProfile => {
  const ribWidth = width / RIB_COUNT;
  const faceWidth = 1 - RIB_GAP;
  const edgeWidth = Math.max(1.4, ribWidth * EDGE_FRACTION);
  const specWidth = Math.max(1.1, ribWidth * SPEC_FRACTION);
  // Highlight position measured across the whole pitch, not just the face.
  const specCentre = RIB_GAP / 2 + HIGHLIGHT_POSITION * faceWidth;

  const shading = new Float32Array(width);
  const hot = new Float32Array(width);

  for (let x = 0; x < width; x++) {
    let shadeSum = 0;
    let hotSum = 0;

    for (let k = 0; k < SUB_SAMPLES; k++) {
      // Position inside this rib's pitch, 0..1. The dark gap straddles the
      // boundary, so it sits half at the end of one rib and half at the
      // start of the next.
      const u = ((((x + (k + 0.5) / SUB_SAMPLES) / ribWidth) % 1) + 1) % 1;

      const v = (u - RIB_GAP / 2) / faceWidth;
      const face = v <= 0 || v >= 1 ? 0 : faceShade(v);

      // Near-black line exactly on the rib boundary.
      const edge =
        EDGE_FLOOR +
        (1 - EDGE_FLOOR) *
          smoothstep(0, edgeWidth, Math.min(u, 1 - u) * ribWidth);

      // Bright specular line inside the rib.
      const d = (u - specCentre) * ribWidth;
      const core = Math.exp(-((d / specWidth) ** 2));
      const halo = Math.exp(-((d / (specWidth * SPEC_HALO_SCALE)) ** 2));
      const spec = (core + SPEC_HALO_WEIGHT * halo) * edge;

      shadeSum += Math.min(1, face * edge + SPEC_GAIN * spec);
      hotSum += core * edge;
    }

    shading[x] = shadeSum / SUB_SAMPLES;
    hot[x] = hotSum / SUB_SAMPLES;
  }

  return { shading, hot, ribWidth };
};
