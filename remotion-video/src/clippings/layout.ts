import { BLOCK_W, HEIGHT } from "./constants";
import { rndChance, rndInt, rndPick, rndRange } from "../lib/seededRandom";
import type { TornSides } from "../lib/tornEdge";
import type { Variant } from "./variants";

/**
 * The layout of one lattice block: fourteen clippings, scattered rather than
 * gridded, overlapping freely.
 *
 * The anchors below are hand-placed. A purely random scatter at this density
 * either clumps or leaves holes; fixed anchors with seeded jitter keep the
 * spread even while still looking unplanned. Anything that runs off the right
 * edge of the block simply reappears at the left, because the neighbouring
 * lattice copy draws the same clipping one block over.
 *
 * Draw order is array order, so later clippings partially cover earlier ones.
 */

export type SizeClass = "xs" | "s" | "m" | "l" | "xl";

/**
 * Sheet widths in px at 4K. The 280:1480 range is a little over 1:5.
 *
 * These are deliberately modest against a 3840px frame: the wall has to stay
 * visible between the sheets, and the body type has to end up small enough to
 * be illegible at the size it is actually seen.
 */
const SIZE_WIDTHS: Record<SizeClass, [number, number]> = {
  xs: [280, 345],
  s: [385, 505],
  m: [565, 790],
  l: [880, 1130],
  xl: [1280, 1480],
};

/** Sheet height as a multiple of width. */
const SIZE_ASPECT: Record<SizeClass, [number, number]> = {
  xs: [0.55, 0.95],
  s: [0.7, 1.15],
  m: [0.72, 1.2],
  l: [0.66, 1.05],
  xl: [0.6, 0.92],
};

type Anchor = {
  fx: number;
  fy: number;
  size: SizeClass;
  partial?: boolean;
};

const ANCHORS: Anchor[] = [
  { fx: 0.055, fy: 0.30, size: "xl", partial: true },
  { fx: 0.165, fy: 0.74, size: "m" },
  { fx: 0.125, fy: 0.04, size: "s" },
  { fx: 0.275, fy: 0.44, size: "l" },
  { fx: 0.315, fy: 0.88, size: "xs" },
  { fx: 0.385, fy: 0.12, size: "m" },
  { fx: 0.455, fy: 0.68, size: "l", partial: true },
  { fx: 0.525, fy: 0.22, size: "s" },
  { fx: 0.625, fy: 0.50, size: "xl" },
  { fx: 0.705, fy: 0.88, size: "m" },
  { fx: 0.735, fy: 0.10, size: "xs" },
  { fx: 0.815, fy: 0.28, size: "l" },
  { fx: 0.885, fy: 0.72, size: "m", partial: true },
  { fx: 0.955, fy: 0.46, size: "s" },
];

export type ClippingSpec = {
  index: number;
  seed: string;
  /** Centre within the block. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  paperHex: string;
  headline: string;
  byline: string;
  torn: TornSides;
  partial: boolean;
  columns: number;
  headlineLines: number;
  bobAmp: number;
  bobPeriod: number;
  bobPhase: number;
  chart: boolean;
  halftone: boolean;
};

/** Bob periods, all exact divisors of 420, so every bob closes with the loop. */
const BOB_PERIODS = [420, 210, 140, 105, 84, 70, 60];

const pickTornSides = (seed: string): TornSides => {
  // Some sheets are torn on all four sides, most on two or three with the
  // remainder guillotined.
  const roll = rndRange(`${seed}:tornroll`, 0, 1);
  if (roll < 0.32) return { top: true, right: true, bottom: true, left: true };
  const sides: TornSides = { top: true, right: true, bottom: true, left: true };
  const cutCount = roll < 0.78 ? 1 : 2;
  const order = ["top", "right", "bottom", "left"] as const;
  const offsets = [0, 1, 2, 3];
  const start = rndInt(`${seed}:cutstart`, 0, 4);
  for (let i = 0; i < cutCount; i++) {
    sides[order[offsets[(start + i * 2) % 4]]] = false;
  }
  return sides;
};

/**
 * Fisher-Yates over a seeded stream. Drawing each clipping's headline
 * independently clusters badly at this sample size — three of the ten would
 * show up four times and three not at all. Shuffling instead guarantees all
 * ten appear, and the clippings past the tenth repeat one at a different size,
 * which is what the wall wants anyway.
 */
const shuffledIndices = (seed: string, count: number): number[] => {
  const order: number[] = [];
  for (let i = 0; i < count; i++) order.push(i);
  for (let i = count - 1; i > 0; i--) {
    const j = rndInt(`${seed}:swap:${i}`, 0, i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
};

export const buildLayout = (variant: Variant, variantKey: string): ClippingSpec[] => {
  const specs: ClippingSpec[] = [];
  const headlineOrder = shuffledIndices(`${variantKey}:headlines`, variant.headlines.length);
  const repeatOrder = shuffledIndices(`${variantKey}:repeats`, variant.headlines.length);

  for (let i = 0; i < ANCHORS.length; i++) {
    const a = ANCHORS[i];
    const seed = `${variantKey}:clip:${i}`;
    const [wMin, wMax] = SIZE_WIDTHS[a.size];
    const w = rndRange(`${seed}:w`, wMin, wMax);
    const [arMin, arMax] = SIZE_ASPECT[a.size];
    const h = w * rndRange(`${seed}:ar`, arMin, arMax);

    // Jitter the anchor so the arrangement never settles into a rhythm.
    const x = a.fx * BLOCK_W + rndRange(`${seed}:jx`, -110, 110);
    const y = a.fy * HEIGHT + rndRange(`${seed}:jy`, -95, 95);

    const partial = a.partial ?? false;
    const bigEnoughForThreeColumns = w > 860;

    specs.push({
      index: i,
      seed,
      x,
      y,
      w,
      h,
      rotation: (rndRange(`${seed}:rot`, -4, 4) * Math.PI) / 180,
      paperHex: rndPick(`${seed}:paper`, variant.palette.papers),
      headline: variant.headlines[headlineIndexFor(i, headlineOrder, repeatOrder)],
      byline: rndPick(`${seed}:byline`, variant.bylines),
      torn: pickTornSides(seed),
      partial,
      // Wide sheets always take three columns: two columns across a 1300px
      // measure gives a line length no newspaper would set.
      columns: w > 1000 ? 3 : bigEnoughForThreeColumns && rndChance(`${seed}:cols`, 0.6) ? 3 : 2,
      // A long headline forced onto one line shrinks until it is no longer a
      // display size, so the line budget follows the headline's length.
      headlineLines: partial
        ? 2
        : variant.headlines[headlineIndexFor(i, headlineOrder, repeatOrder)].split(" ").length <= 3
          ? rndInt(`${seed}:hlines`, 1, 3)
          : rndInt(`${seed}:hlines`, 2, 4),
      bobAmp: rndRange(`${seed}:bobamp`, 2.4, 4),
      bobPeriod: rndPick(`${seed}:bobperiod`, BOB_PERIODS),
      bobPhase: rndRange(`${seed}:bobphase`, 0, Math.PI * 2),
      chart: indexIn(variant.features.chartSlots, i),
      halftone: indexIn(variant.features.halftoneSlots, i),
    });
  }

  return specs;
};

const headlineIndexFor = (i: number, order: number[], repeats: number[]): number =>
  i < order.length ? order[i] : repeats[(i - order.length) % repeats.length];

const indexIn = (list: number[], value: number): boolean => {
  for (let i = 0; i < list.length; i++) {
    if (list[i] === value) return true;
  }
  return false;
};
