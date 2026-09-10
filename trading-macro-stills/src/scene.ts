import { context2d, makeCanvas, type Ctx, type Placement } from "./lib/canvas";
import { compositionSeed, makeRng, type Rng } from "./lib/rng";
import type { CompositionSpec, LayerSpec } from "./types";

export type Bracket = {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  blur: number;
  bloom: number;
};

export type LayerRender = {
  spec: LayerSpec;
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  /** Nominal layer-space size the element draws in. */
  width: number;
  height: number;
  /** Resolution the buffer is actually allocated at. */
  resolution: number;
  /** The layer's bloom radius in buffer pixels. */
  glowPx: number;
  rng: Rng;
  seriesRng: Rng;
  bracket: number;
  placement: Placement;
};

/**
 * All pixel-valued numbers in COMPOSITIONS — font sizes, blur radii, candle
 * widths, grid pitches — are quoted at this reference size. Everything is
 * scaled from it, so the same specs render correctly at any output size and
 * the contact sheet can reuse the renderer at tile resolution.
 */
export const REFERENCE_WIDTH = 3840;
export const REFERENCE_HEIGHT = 2560;

export type Scene = {
  comp: CompositionSpec;
  width: number;
  height: number;
  brackets: Bracket[];
  flare: { canvas: HTMLCanvasElement; ctx: Ctx };
  /** The visible canvas, filled in by the ref once React has attached it. */
  output: { current: HTMLCanvasElement | null };
  layers: LayerRender[];
  rng: Rng;
};

/**
 * Five buffers, ordered far-to-near through the focus band:
 *
 *   0  well behind focus   heavy blur
 *   1  just behind focus   moderate blur
 *   2  in the focus band   sharp
 *   3  just in front       moderate blur
 *   4  well in front       heavy blur
 *
 * Bracketing by SIGNED distance rather than by blur amount is what lets five
 * buffers stand in for per-layer blur: the buffers still composite in depth
 * order, so a soft foreground layer stays in front of the sharp one.
 */
export const bracketFor = (comp: CompositionSpec, depth: number): number => {
  const s = depth - comp.focusDepth;
  if (s > comp.midBand) return 0;
  if (s > comp.focusBand) return 1;
  if (s < -comp.midBand) return 4;
  if (s < -comp.focusBand) return 3;
  return 2;
};

/** Which price walk a layer draws from. Untagged layers get their own. */
const seriesTag = (spec: LayerSpec): string => {
  if (spec.content.kind === "candles") return spec.content.series ?? spec.id;
  if (spec.content.kind === "curves")
    return spec.content.source.series ?? spec.id;
  return spec.id;
};

/** Near layers are larger. Overridable per layer when a setup needs it. */
const scaleFor = (spec: LayerSpec): number =>
  spec.scale ?? 1.28 - spec.depth * 0.5;

const RESOLUTION = [0.5, 0.8, 1, 0.8, 0.5];
const SLICES = [220, 320, 640, 320, 220];

export const buildScene = (
  comp: CompositionSpec,
  width: number,
  height: number,
): Scene => {
  const unit = width / REFERENCE_WIDTH;

  const brackets: Bracket[] = comp.bracketBlur.map((blur, i) => {
    const canvas = makeCanvas(width, height);
    return {
      canvas,
      ctx: context2d(canvas),
      blur: blur * unit,
      bloom: comp.bracketBloom[i],
    };
  });

  const flareCanvas = makeCanvas(width, height);

  const layers: LayerRender[] = comp.layers.map((spec) => {
    const bracket = bracketFor(comp, spec.depth);
    const resolution = RESOLUTION[bracket];
    // Elements always draw in reference-sized layer space; the buffer is
    // allocated at output size and the transform bridges the two.
    const w = spec.w * REFERENCE_WIDTH;
    const h = spec.h * REFERENCE_HEIGHT;
    const canvas = makeCanvas(spec.w * width * resolution, spec.h * height * resolution);
    const ctx = context2d(canvas);
    ctx.scale(unit * resolution, (height / REFERENCE_HEIGHT) * resolution);

    const scale = scaleFor(spec);
    const placement: Placement = {
      cx: spec.cx * width,
      cy: spec.cy * height,
      w: spec.w * width * scale,
      h: spec.h * height * scale,
      rotation: (spec.rotate * Math.PI) / 180,
      keystone: spec.keystone,
      shear: spec.shear,
      alpha: spec.opacity,
      composite: "lighter",
      fade: spec.fade
        ? {
            from: spec.fade.from,
            to: spec.fade.to,
            angle: (spec.fade.angle * Math.PI) / 180,
          }
        : undefined,
      slices: SLICES[bracket],
    };

    return {
      spec,
      canvas,
      ctx,
      width: w,
      height: h,
      resolution,
      glowPx: spec.glow * unit * resolution,
      rng: makeRng(compositionSeed(comp.id, spec.id)),
      seriesRng: makeRng(compositionSeed(comp.id, `series/${seriesTag(spec)}`)),
      bracket,
      placement,
    };
  });

  return {
    comp,
    width,
    height,
    brackets,
    flare: { canvas: flareCanvas, ctx: context2d(flareCanvas) },
    output: { current: null },
    layers,
    rng: makeRng(compositionSeed(comp.id, "scene")),
  };
};
