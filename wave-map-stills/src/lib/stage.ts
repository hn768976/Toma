import type {GeoProjection} from "d3-geo";
import {buildBaseDots, type DotSet} from "./dots";
import {hexToRgb, type Rgb} from "./color";
import type {CompositionSpec} from "./compositions";
import {
  buildProjection,
  landWithoutAntarctica,
  rasteriseLand,
  type CountryTopology,
  type LandMask,
} from "./map";
import {PALETTES, type PaletteName} from "./palettes";
import {makeRng, type Rng} from "./rng";
import {buildWaveField, type WaveField} from "./wave";

/** Maximum blur at the far extremes of the frame, px at 4K. */
export const MAX_BLUR = 46;

/**
 * Four blur buckets. Every dot lands in exactly one of them and each buffer is
 * blurred ONCE at composite time — blurring per dot would be unusable at 4K.
 * The two softest buckets are rendered at reduced resolution: blur destroys
 * that detail anyway, and it keeps the memory footprint sane.
 */
export const BRACKETS = [
  {blur: 0, scale: 1, boost: 1},
  {blur: 9, scale: 1, boost: 1.35},
  {blur: 22, scale: 0.5, boost: 1.8},
  {blur: MAX_BLUR, scale: 0.25, boost: 2.4},
] as const;

export type Buffer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
};

export type PaletteRgb = {
  bgDeep: Rgb;
  bgWash: Rgb;
  ocean: Rgb;
  land: Rgb;
  landBright: Rgb;
  lightCore: Rgb;
  accent: Rgb;
};

export type Stage = {
  width: number;
  height: number;
  /** Scale of the frame relative to the 4K reference the numbers are tuned at. */
  k: number;
  comp: CompositionSpec;
  pal: PaletteRgb;
  rng: Rng;
  projection: GeoProjection;
  mask: LandMask;
  dots: DotSet;
  wave: WaveField;
  light: {x: number; y: number; r: number; gain: number};
  /** Padded field rectangle in field-space px. */
  field: {x0: number; y0: number; w: number; h: number};
  buffers: Buffer[];
  lightLayer: Buffer;
  /** Continuous blur radius in px for a screen position. */
  blurAt: (x: number, y: number) => number;
  /**
   * Which buffer a dot goes in. Four buckets would band visibly at their
   * boundaries, so the choice is dithered: a dot sitting between two buckets
   * lands in either one with a probability set by how far between them it is.
   * `dither` is a per-dot random in [0, 1).
   */
  bracketAt: (blur: number, dither: number) => number;
};

const makeBuffer = (w: number, h: number, scale: number): Buffer => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d context unavailable for an offscreen buffer");
  }
  return {canvas, ctx, scale};
};

export const buildStage = (args: {
  topo: CountryTopology;
  comp: CompositionSpec;
  palette: PaletteName;
  seed: string;
  width: number;
  height: number;
}): Stage => {
  const {topo, comp, width, height} = args;
  const k = width / 3840;
  const rng = makeRng(args.seed);
  const p = PALETTES[args.palette];
  const pal: PaletteRgb = {
    bgDeep: hexToRgb(p.bgDeep),
    bgWash: hexToRgb(p.bgWash),
    ocean: hexToRgb(p.ocean),
    land: hexToRgb(p.land),
    landBright: hexToRgb(p.landBright),
    lightCore: hexToRgb(p.lightCore),
    accent: hexToRgb(p.accent),
  };

  const wave = buildWaveField(comp, rng, k);

  // The field is padded so that the tilt, the wave displacement and the blur
  // never expose an empty edge.
  const tiltRad = (Math.abs(comp.tilt) * Math.PI) / 180;
  const tiltPad =
    (Math.sin(tiltRad) * height) / 2 + (1 - Math.cos(tiltRad)) * (width / 2);
  const padX = 220 * k + tiltPad + MAX_BLUR * k;
  const padY = 220 * k + tiltPad + wave.maxAmp + MAX_BLUR * k;
  const field = {
    x0: -padX,
    y0: -padY,
    w: width + padX * 2,
    h: height + padY * 2,
  };

  const projection = buildProjection(comp, width, height);
  const land = landWithoutAntarctica(topo);
  const maskRes = Math.min(0.65, Math.max(0.22, 1.2 / (comp.pitch * k)));
  const mask = rasteriseLand(
    land,
    projection,
    field.x0,
    field.y0,
    field.w,
    field.h,
    maskRes,
  );

  const dots = buildBaseDots(mask, comp.pitch * k, rng);

  const light = {
    x: comp.light[0] * width,
    y: comp.light[1] * height,
    r: comp.lightRadius * width,
    gain: comp.lightGain,
  };

  const bandAngle = (comp.band.angle * Math.PI) / 180;
  const nx = -Math.sin(bandAngle);
  const ny = Math.cos(bandAngle);
  const ax = comp.band.anchor[0] * width;
  const ay = comp.band.anchor[1] * height;
  const half = comp.band.halfWidth * k;
  const fall = comp.band.falloff * k;
  const blurAt = (x: number, y: number) => {
    const d = Math.abs((x - ax) * nx + (y - ay) * ny);
    const t = Math.min(1, Math.max(0, (d - half) / fall));
    return Math.pow(t, 1.15) * MAX_BLUR * k;
  };

  const buffers = BRACKETS.map((b) => makeBuffer(field.w, field.h, b.scale));
  const lightLayer = makeBuffer(width, height, 0.5);

  return {
    width,
    height,
    k,
    comp,
    pal,
    rng,
    projection,
    mask,
    dots,
    wave,
    light,
    field,
    buffers,
    lightLayer,
    blurAt,
    bracketAt: (blur: number, dither: number) => {
      const b = blur / k;
      for (let i = BRACKETS.length - 1; i > 0; i--) {
        if (b >= BRACKETS[i].blur) {
          return i;
        }
        if (b >= BRACKETS[i - 1].blur) {
          const f =
            (b - BRACKETS[i - 1].blur) /
            (BRACKETS[i].blur - BRACKETS[i - 1].blur);
          return dither < f ? i : i - 1;
        }
      }
      return 0;
    },
  };
};

/** How strongly the light lifts a dot at this distance. */
export const lightFalloff = (stage: Stage, x: number, y: number): number => {
  const dx = x - stage.light.x;
  const dy = y - stage.light.y;
  const d2 = (dx * dx + dy * dy) / (stage.light.r * stage.light.r);
  // Deliberately gentle: a tight falloff would concentrate the lift into a
  // bright knot of dots and read as a light "dot" again.
  return 1 / (1 + d2 * 0.7);
};
