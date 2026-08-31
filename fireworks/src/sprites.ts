import {hexToRgb, mixRgb, rgbCss, rgbaCss} from './colors';
import type {VariantConfig, VariantName} from './variants';

/**
 * Particles are drawn as pre-rendered glow sprites rather than as a fresh
 * radial gradient each time — several thousand gradients a frame at 4K is not
 * affordable, and a sprite gives the same soft bloom for one drawImage.
 *
 * One sprite exists per palette colour per cooling step, so a particle can
 * shift warm as it fades without building anything at draw time.
 */

const SPRITE_SIZE = 128;
export const EMBER_STEPS = 6;
export const MAX_EMBER_MIX = 0.72;

export type SpriteSheet = {
  /** glow[colorIndex][emberStep] */
  readonly glow: readonly (readonly HTMLCanvasElement[])[];
  /** css[colorIndex][emberStep] — solid colour, for trail strokes. */
  readonly css: readonly (readonly string[])[];
  readonly flash: HTMLCanvasElement;
  readonly shell: HTMLCanvasElement;
  readonly shellCss: string;
};

const sheets = new Map<VariantName, SpriteSheet>();

const makeGlow = (hex: string, coreHex: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }
  const c = SPRITE_SIZE / 2;
  const rgb = hexToRgb(hex);
  const core = hexToRgb(coreHex);
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  // Only the very centre is white hot; the colour has to survive the bloom,
  // otherwise every burst reads as a white one.
  gradient.addColorStop(0, rgbaCss(mixRgb(rgb, core, 0.7), 1));
  gradient.addColorStop(0.08, rgbaCss(mixRgb(rgb, core, 0.3), 0.98));
  gradient.addColorStop(0.2, rgbaCss(rgb, 0.88));
  gradient.addColorStop(0.36, rgbaCss(rgb, 0.4));
  gradient.addColorStop(0.6, rgbaCss(rgb, 0.13));
  gradient.addColorStop(1, rgbaCss(rgb, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
};

export const emberStepOf = (mix: number): number => {
  const step = Math.round((mix / MAX_EMBER_MIX) * (EMBER_STEPS - 1));
  return step < 0 ? 0 : step > EMBER_STEPS - 1 ? EMBER_STEPS - 1 : step;
};

export const getSprites = (
  name: VariantName,
  variant: VariantConfig,
): SpriteSheet => {
  const cached = sheets.get(name);
  if (cached) {
    return cached;
  }
  const {palette} = variant;
  const ember = hexToRgb(palette.ember);
  const glow: HTMLCanvasElement[][] = [];
  const css: string[][] = [];

  for (const entry of palette.burst) {
    const base = hexToRgb(entry.value);
    const row: HTMLCanvasElement[] = [];
    const cssRow: string[] = [];
    for (let step = 0; step < EMBER_STEPS; step++) {
      const t = (step / (EMBER_STEPS - 1)) * MAX_EMBER_MIX;
      const mixed = mixRgb(base, ember, t);
      row.push(makeGlow(rgbCss(mixed), palette.flash));
      cssRow.push(rgbCss(mixed));
    }
    glow.push(row);
    css.push(cssRow);
  }

  const sheet: SpriteSheet = {
    glow,
    css,
    flash: makeGlow(palette.flash, palette.flash),
    shell: makeGlow(palette.ember, palette.flash),
    shellCss: rgbCss(ember),
  };
  sheets.set(name, sheet);
  return sheet;
};
