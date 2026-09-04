import type { Crop, TreeVariant } from "./assets";
import { GLOW_X, LOW_RES } from "./constants";
import type { Palette } from "./palettes";
import { mulberry32, range, type Rng } from "./prng";

/**
 * Depth tiers, far to near. Depth in this shot is entirely 2D — it comes from
 * scale, tone, blur and how much fog sits in front of each tier. There is no
 * camera and no parallax, exactly as in the reference.
 */
export type Tier = {
  name: string;
  seed: number;
  count: number;
  /** Tree height as a fraction of frame height. */
  height: [number, number];
  /** Where the trunk base sits, as a fraction of frame height. */
  baseY: [number, number];
  /** Blur radius in reference (3840-wide) pixels. */
  blur: number;
  alpha: number;
  color: "treeFar" | "treeMid" | "treeNear";
  /** Peak sway of the crown, in degrees. */
  sway: number;
  /** Aligns the widest gap between trunks with the distant glow. */
  alignGapToGlow: boolean;
  /** Density of the fog wash drawn immediately after this tier. */
  wash: number;
  /** Which fog plane (texture/drift speed) the following wash uses. */
  washPlane: number;
  /** Tiers drawn into the low-resolution buffer: cheap, and they are blurred
   *  past the point where the extra resolution would ever be visible. */
  lowRes: boolean;
  /** Explicit trunk positions, used by the near tier to hold its trees against
   *  the frame edges instead of letting them sit across the middle. */
  anchors?: readonly number[];
  /**
   * Windows onto the artwork the tier draws instead of whole trees, assigned to
   * instances in turn. The near tier uses these: a whole crown across the
   * middle of the frame buries the shot, so it draws a slab of trunk and inner
   * branches whose crown leaves frame at the top. Keeping `cx` at 0.5 keeps the
   * trunk centred in the slab, so instances still align on the ground line.
   */
  crops?: readonly Crop[];
};

export const TIERS: readonly Tier[] = [
  {
    name: "far-b",
    seed: 1013,
    count: 15,
    height: [0.22, 0.36],
    baseY: [0.876, 0.892],
    blur: 30,
    alpha: 0.28,
    color: "treeFar",
    sway: 0.06,
    alignGapToGlow: true,
    wash: 0.66,
    washPlane: 0,
    lowRes: true,
  },
  {
    name: "far-a",
    seed: 2027,
    count: 12,
    height: [0.33, 0.52],
    baseY: [0.888, 0.906],
    blur: 19,
    alpha: 0.46,
    color: "treeFar",
    sway: 0.09,
    alignGapToGlow: true,
    wash: 0.54,
    washPlane: 1,
    lowRes: true,
  },
  {
    name: "mid-a",
    seed: 3041,
    count: 10,
    height: [0.48, 0.74],
    baseY: [0.9, 0.922],
    blur: 11,
    alpha: 0.72,
    color: "treeMid",
    sway: 0.16,
    alignGapToGlow: true,
    wash: 0.42,
    crops: [
      { cx: 0.5, w: 1, h: 1 },
      { cx: 0.56, w: 0.86, h: 0.9 },
      { cx: 0.46, w: 0.9, h: 0.96 },
      { cx: 0.5, w: 0.76, h: 1 },
    ],
    washPlane: 2,
    lowRes: true,
  },
  {
    name: "mid-b",
    seed: 4057,
    count: 7,
    height: [0.72, 1.06],
    baseY: [0.918, 0.945],
    blur: 6,
    alpha: 0.9,
    color: "treeNear",
    sway: 0.26,
    alignGapToGlow: true,
    wash: 0.2,
    crops: [
      { cx: 0.5, w: 1, h: 1 },
      { cx: 0.44, w: 0.84, h: 0.93 },
      { cx: 0.58, w: 0.78, h: 0.97 },
    ],
    washPlane: 3,
    lowRes: false,
  },
  {
    name: "near",
    seed: 5077,
    count: 4,
    height: [1.08, 1.62],
    baseY: [0.99, 1.07],
    blur: 2,
    alpha: 1,
    color: "treeNear",
    sway: 0.4,
    alignGapToGlow: false,
    wash: 0.06,
    washPlane: 4,
    lowRes: false,
    // Held against the left and right edges, with one trunk running the full
    // height of the frame just inside the frame line.
    anchors: [-0.05, 0.07, 0.9, 1.06],
    crops: [
      { cx: 0.5, w: 0.24, h: 0.88 },
      { cx: 0.42, w: 0.34, h: 0.74 },
      { cx: 0.58, w: 0.3, h: 0.82 },
      { cx: 0.5, w: 0.4, h: 0.68 },
    ],
  },
] as const;

export type TreeInstance = {
  /** Trunk base, as fractions of frame width/height. */
  x: number;
  y: number;
  /** Height as a fraction of frame height. */
  height: number;
  flip: boolean;
  rotation: number;
  swayCycles: number;
  swayPhase: number;
  swayAmp: number;
  /** Window of the artwork this instance draws, if the tier uses crops. */
  crop?: Crop;
};

/**
 * Irregular trunk spacing: mostly medium gaps, some close pairs, some wide
 * clearings. Evenly spaced trunks are the fastest way to make a generated
 * forest look generated.
 */
const spacings = (rng: Rng): number[] => {
  const xs: number[] = [];
  let x = range(rng, -0.14, 0.0);
  while (x < 1.14) {
    xs.push(x);
    const r = rng();
    const step =
      r < 0.24
        ? range(rng, 0.022, 0.055) // close pair
        : r < 0.82
          ? range(rng, 0.085, 0.17)
          : range(rng, 0.21, 0.34); // clearing
    x += step;
  }
  return xs;
};

/** Slides the run of trunks so its widest clearing frames the distant glow. */
const alignWidestGap = (xs: number[], target: number) => {
  if (xs.length < 2) return xs;
  let best = 0;
  let bestCentre = xs[0];
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i] - xs[i - 1];
    if (gap > best) {
      best = gap;
      bestCentre = (xs[i] + xs[i - 1]) / 2;
    }
  }
  const delta = target - bestCentre;
  return xs.map((x) => x + delta);
};

const layouts = new Map<string, TreeInstance[]>();

export const getTierLayout = (tier: Tier): TreeInstance[] => {
  const cached = layouts.get(tier.name);
  if (cached) return cached;

  const rng = mulberry32(tier.seed);
  let chosen: number[];
  if (tier.anchors) {
    chosen = tier.anchors
      .map((x) => x + range(rng, -0.02, 0.02))
      .slice(0, tier.count);
  } else {
    let xs = spacings(rng);
    if (tier.alignGapToGlow) xs = alignWidestGap(xs, GLOW_X);
    // Keep the trees that land in or just outside frame, then thin to count.
    const visible = xs.filter((x) => x > -0.2 && x < 1.2);
    const step = Math.max(1, Math.floor(visible.length / tier.count));
    chosen = visible.filter((_, i) => i % step === 0).slice(0, tier.count);
  }

  const instances = chosen.map((x, i) => ({
    x,
    y: range(rng, tier.baseY[0], tier.baseY[1]),
    height: range(rng, tier.height[0], tier.height[1]),
    flip: rng() < 0.5,
    rotation: range(rng, -3, 3),
    // Staggered integer cycle counts: every tree returns to its starting
    // attitude at frame 900, but none of them sway in step.
    swayCycles: 1 + (i % 3),
    swayPhase: rng(),
    swayAmp: tier.sway * range(rng, 0.7, 1.3),
    crop: tier.crops ? tier.crops[i % tier.crops.length] : undefined,
  }));

  layouts.set(tier.name, instances);
  return instances;
};

/**
 * Pixel height to rasterise the trace at for a tier: the tallest instance the
 * tier can produce, rounded up to a bucket so nearby tiers share one raster.
 * Low-resolution tiers are drawn into a smaller buffer and need proportionally
 * less, which is most of the memory saved.
 */
export const rasterHeight = (tier: Tier, frameHeight: number) => {
  const drawn = tier.height[1] * frameHeight * (tier.lowRes ? LOW_RES : 1);
  return Math.min(4096, Math.max(256, Math.ceil(drawn / 256) * 256));
};

/** The variant an instance draws: its tier's colour and size, plus its crop. */
export const variantFor = (
  tier: Tier,
  inst: TreeInstance,
  palette: Palette,
  frameHeight: number,
): TreeVariant => ({
  color: palette[tier.color],
  height: rasterHeight(tier, frameHeight),
  crop: inst.crop,
});

/** Every rasterisation the scene needs, for prepareTrees(). */
export const treeVariants = (
  palette: Palette,
  frameHeight: number,
): TreeVariant[] =>
  TIERS.flatMap((tier) =>
    getTierLayout(tier).map((inst) =>
      variantFor(tier, inst, palette, frameHeight),
    ),
  );
