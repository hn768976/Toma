/**
 * The travelling element field.
 *
 * Looping requirement: over 360 frames every element travels outward by
 * exactly one ring spacing. For the last frame to hand back to the first, the
 * field must therefore be *periodic in ring index* — the element that ends up
 * where its outward neighbour started has to be indistinguishable from it.
 *
 * So one pattern of elements is generated and repeated in every ring cell.
 * That alone would produce perfectly straight radial spokes, so each family
 * also carries a `twist`: an angular offset proportional to the (continuous)
 * ring coordinate. Because the twist is a function of that coordinate and not
 * of an element's identity, the periodicity survives it exactly, while the
 * rings stagger against each other.
 *
 * Element positions are `(ringIndex + u + frame / duration) mod RINGS` — the
 * recycling is arithmetic, never stateful.
 *
 * Visible ring count is RINGS x (number of ring-forming families); the counts
 * below are tuned to the reference, where each ring is sparse and the density
 * comes from having many rings rather than many elements per ring.
 */

import { RINGS, TAU } from "./constants";
import { mulberry32 } from "./random";

/** 0 = dot, 1 = filled capsule, 2 = outlined capsule. */
export type ElementShape = 0 | 1 | 2;

export type PatternElement = {
  theta: number;
  /** Sub-ring radial offset, in [0, 1). */
  u: number;
  /** Radians of angular offset per ring cell. */
  twist: number;
  shape: ElementShape;
  lenMul: number;
  thickMul: number;
  bright: number;
  /** Used to decide which hue family the element falls into. */
  colorRand: number;
  /** Twinkle: integer cycles per loop, so it closes. */
  twCycles: number;
  twPhase: number;
  glow: number;
};

type Variant = {
  shape: ElementShape;
  weight: number;
  lenMul: number;
  thickMul: number;
  bright: number;
  glow: number;
};

type Family = {
  count: number;
  /** Where in the ring cell this family sits. */
  u: number;
  /** Radial spread. Small values form a crisp ring; 1 scatters over the cell. */
  uJitter: number;
  /** Twist as a fraction of this family's own angular step. */
  twistSteps: number;
  /** Angular jitter, as a fraction of the angular step. */
  jitter: number;
  variants: Variant[];
};

const FAMILIES: Family[] = [
  // Inner dot ring of each cell.
  {
    count: 84,
    u: 0,
    uJitter: 0.03,
    twistSteps: 0.5,
    jitter: 0.09,
    variants: [
      { shape: 0, weight: 0.84, lenMul: 1, thickMul: 1, bright: 1, glow: 0.4 },
      // A few dashes salted through the dot rings, as in the reference.
      { shape: 1, weight: 0.16, lenMul: 1.1, thickMul: 0.3, bright: 0.75, glow: 0.2 },
    ],
  },
  // Middle ring: outlined capsules with dots between them.
  {
    count: 60,
    u: 0.34,
    uJitter: 0.03,
    twistSteps: 0.5,
    jitter: 0.09,
    variants: [
      { shape: 2, weight: 0.5, lenMul: 1.05, thickMul: 1.05, bright: 0.85, glow: 0.4 },
      { shape: 0, weight: 0.34, lenMul: 0.9, thickMul: 1, bright: 0.95, glow: 0.3 },
      { shape: 1, weight: 0.16, lenMul: 1.25, thickMul: 0.32, bright: 0.8, glow: 0.25 },
    ],
  },
  // Capsule ring: the bold filled bars that dominate the outer frame.
  {
    count: 38,
    u: 0.67,
    uJitter: 0.035,
    twistSteps: 0.5,
    jitter: 0.08,
    variants: [
      { shape: 1, weight: 0.56, lenMul: 1, thickMul: 1, bright: 1.1, glow: 1 },
      { shape: 2, weight: 0.26, lenMul: 1.12, thickMul: 1.1, bright: 0.8, glow: 0.35 },
      { shape: 1, weight: 0.18, lenMul: 1.3, thickMul: 0.34, bright: 0.85, glow: 0.25 },
    ],
  },
  // Fine dust. A full-cell uJitter scatters it between the rings instead of
  // forming one of its own.
  {
    count: 84,
    u: 0.5,
    uJitter: 1,
    twistSteps: 0.5,
    jitter: 1,
    variants: [
      { shape: 0, weight: 1, lenMul: 0.42, thickMul: 0.42, bright: 0.5, glow: 0 },
    ],
  },
];

const pickVariant = (variants: Variant[], r: number): Variant => {
  let acc = 0;
  for (const v of variants) {
    acc += v.weight;
    if (r < acc) {
      return v;
    }
  }
  return variants[variants.length - 1];
};

/**
 * One ring cell's worth of elements. Repeated across all RINGS cells at draw
 * time — see the module comment for why they must be identical.
 */
export const PATTERN: PatternElement[] = (() => {
  const rnd = mulberry32(0x13c0de);
  const out: PatternElement[] = [];
  for (const fam of FAMILIES) {
    const step = TAU / fam.count;
    const total = fam.variants.reduce((s, v) => s + v.weight, 0);
    for (let j = 0; j < fam.count; j++) {
      const v = pickVariant(fam.variants, rnd() * total);
      out.push({
        theta: (j + (rnd() - 0.5) * fam.jitter) * step,
        u: fam.u + (rnd() - 0.5) * fam.uJitter,
        twist: fam.twistSteps * step,
        shape: v.shape,
        lenMul: v.lenMul * (0.78 + rnd() * 0.44),
        thickMul: v.thickMul * (0.85 + rnd() * 0.3),
        bright: v.bright * (0.7 + rnd() * 0.5),
        colorRand: rnd(),
        twCycles: 2 + Math.floor(rnd() * 9),
        twPhase: rnd(),
        glow: v.glow,
      });
    }
  }
  return out;
})();

export const TOTAL_ELEMENTS = PATTERN.length * RINGS;
