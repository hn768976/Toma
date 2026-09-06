import type { Crop, TreeVariant } from "./assets";
import { GLOW_X, LOW_RES } from "./constants";
import type { Palette } from "./palettes";
import { mulberry32, range } from "./prng";

/**
 * Depth tiers, far to near. Depth in this shot is entirely 2D — it comes from
 * scale, tone, blur and how much fog sits in front of each tier. There is no
 * camera and no parallax, exactly as in the reference.
 */
export type Tier = {
  name: string;
  seed: number;
  /** Safety cap. Density is set by `gap`, since how many trees fit depends on
   *  how wide they are. */
  count: number;
  /**
   * Spacing between neighbouring trunks, as a multiple of the two trees' summed
   * half-widths. At 1 their silhouettes just touch; below that their crowns
   * interlace, which real trees at the same distance do, while their trunks
   * stay well apart. Above ~2 is a clearing.
   */
  gap: [number, number];
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
  /**
   * Windows onto the artwork the tier draws instead of whole trees, assigned to
   * instances in turn — how much of the tree, from the base up, each one shows.
   *
   * A crop cuts the artwork on a straight line, so it is only safe where that
   * cut falls outside the frame. These trim the top only (`w: 1`), and the near
   * tier is tall enough that the cut is always above the frame; trimming the
   * sides, or cropping a tier whose trees sit wholly in frame, would show the
   * cut as an unnatural straight edge across the silhouette.
   */
  crops?: readonly Crop[];
};

export const TIERS: readonly Tier[] = [
  {
    name: "far-b",
    gap: [0.42, 1.15],
    seed: 1013,
    count: 110,
    height: [0.18, 0.31],
    baseY: [0.876, 0.892],
    blur: 30,
    alpha: 0.24,
    color: "treeFar",
    sway: 0.06,
    alignGapToGlow: true,
    wash: 0.66,
    washPlane: 0,
    lowRes: true,
  },
  {
    name: "far-a",
    gap: [0.45, 1.25],
    seed: 2027,
    count: 86,
    height: [0.29, 0.46],
    baseY: [0.888, 0.906],
    blur: 19,
    alpha: 0.38,
    color: "treeFar",
    sway: 0.09,
    alignGapToGlow: true,
    wash: 0.46,
    washPlane: 1,
    lowRes: true,
  },
  {
    name: "mid-a",
    gap: [0.45, 1.2],
    seed: 3041,
    count: 60,
    height: [0.48, 0.72],
    baseY: [0.9, 0.922],
    blur: 11,
    alpha: 0.68,
    color: "treeMid",
    sway: 0.16,
    alignGapToGlow: true,
    wash: 0.3,
    washPlane: 2,
    lowRes: true,
  },
  {
    name: "mid-b",
    gap: [0.5, 1.3],
    seed: 4057,
    count: 42,
    height: [0.70, 1.02],
    baseY: [0.918, 0.945],
    blur: 6,
    alpha: 0.82,
    color: "treeNear",
    sway: 0.26,
    alignGapToGlow: true,
    wash: 0.2,
    washPlane: 3,
    lowRes: false,
  },
  {
    name: "near",
    gap: [0.7, 1.35],
    seed: 5077,
    count: 18,
    height: [1.3, 1.9],
    baseY: [0.99, 1.07],
    blur: 2,
    alpha: 1,
    color: "treeNear",
    sway: 0.4,
    alignGapToGlow: false,
    wash: 0.06,
    washPlane: 4,
    lowRes: false,
    crops: [
      { cx: 0.5, w: 1, h: 0.74 },
      { cx: 0.5, w: 1, h: 1 },
      { cx: 0.5, w: 1, h: 0.6 },
      { cx: 0.5, w: 1, h: 0.87 },
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
 * Slides the run of trunks so a clearing frames the distant glow.
 *
 * Only gaps that already fall near the target are candidates. Taking the widest
 * gap anywhere in the run — which is generated far wider than the frame — could
 * mean sliding everything by more than a frame width to bring it into place,
 * which emptied most of the shot.
 */
const REACH = 0.4;

const alignGapToTarget = (xs: number[], target: number) => {
  if (xs.length < 2) return xs;
  let best = -1;
  let bestCentre = target;
  for (let i = 1; i < xs.length; i++) {
    const centre = (xs[i] + xs[i - 1]) / 2;
    if (Math.abs(centre - target) > REACH) continue;
    const gap = xs[i] - xs[i - 1];
    if (gap > best) {
      best = gap;
      bestCentre = centre;
    }
  }
  const delta = target - bestCentre;
  return xs.map((x) => x + delta);
};

const layouts = new Map<string, TreeInstance[]>();

/**
 * Places a tier's trees left to right.
 *
 * Each tree's size is drawn first, then the step to the next trunk is set from
 * the two trees' actual widths. Spacing a forest by a bare fraction of the
 * frame — as this did before — puts a small tree and a large one the same
 * distance apart, so the large pair grow through each other while the small
 * pair sit in a void. Stepping by width keeps every gap valid whatever sizes
 * come up.
 */
export const getTierLayout = (
  tier: Tier,
  artAspect: number,
  frameAspect: number,
): TreeInstance[] => {
  const key = `${tier.name}|${artAspect.toFixed(4)}|${frameAspect.toFixed(4)}`;
  const cached = layouts.get(key);
  if (cached) return cached;

  const rng = mulberry32(tier.seed);
  const draft: (Omit<TreeInstance, "x"> & { halfWidth: number })[] = [];

  for (let i = 0; i < tier.count; i++) {
    const crop = tier.crops ? tier.crops[i % tier.crops.length] : undefined;
    const height = range(rng, tier.height[0], tier.height[1]);
    // Width as a fraction of the frame, for this instance's size and crop.
    const aspect = artAspect * (crop ? crop.w / crop.h : 1);
    const halfWidth = (height * aspect) / frameAspect / 2;
    draft.push({
      y: range(rng, tier.baseY[0], tier.baseY[1]),
      height,
      flip: rng() < 0.5,
      rotation: range(rng, -3, 3),
      // Staggered integer cycle counts: every tree returns to its starting
      // attitude at frame 900, but none of them sway in step.
      swayCycles: 1 + (i % 3),
      swayPhase: rng(),
      swayAmp: tier.sway * range(rng, 0.7, 1.3),
      crop,
      halfWidth,
    });
  }

  const xs: number[] = [];
  let x = -1.7;
  for (let i = 0; i < draft.length; i++) {
    if (i > 0) {
      const span = draft[i - 1].halfWidth + draft[i].halfWidth;
      // Most steps are ordinary; one in six opens a clearing.
      const factor =
        rng() < 0.17
          ? range(rng, tier.gap[1], tier.gap[1] * 1.7)
          : range(rng, tier.gap[0], tier.gap[1]);
      x += span * factor;
    }
    xs.push(x);
    if (x > 2.7) break;
  }

  const placed = tier.alignGapToGlow ? alignGapToTarget(xs, GLOW_X) : xs;
  const instances: TreeInstance[] = [];
  placed.forEach((tx, i) => {
    const d = draft[i];
    if (tx < -0.35 - d.halfWidth || tx > 1.35 + d.halfWidth) return;
    instances.push({
      x: tx,
      y: d.y,
      height: d.height,
      flip: d.flip,
      rotation: d.rotation,
      swayCycles: d.swayCycles,
      swayPhase: d.swayPhase,
      swayAmp: d.swayAmp,
      crop: d.crop,
    });
  });

  layouts.set(key, instances);
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

/**
 * Every rasterisation the scene needs, for prepareTrees(). Enumerated from the
 * tier configuration rather than from the layout, so it can be resolved before
 * the artwork — and therefore the layout, which needs its aspect — is loaded.
 */
export const treeVariants = (
  palette: Palette,
  frameHeight: number,
): TreeVariant[] =>
  TIERS.flatMap((tier) =>
    (tier.crops ?? [undefined]).map((crop) => ({
      color: palette[tier.color],
      height: rasterHeight(tier, frameHeight),
      crop,
    })),
  );
