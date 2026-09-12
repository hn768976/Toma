// Baked, cached raster assets: the nebula "puff" sprites and the star /
// glow sprites.
//
// Baking happens once per browser tab and is then reused for every
// frame. Remotion spawns a handful of tabs and renders frames in them,
// so this cost is paid a few times per render, never per frame.

import { clamp01, fbm2D, ridged2D } from "./noise";
import { mulberry32 } from "./random";

export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const createCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// --- Nebula puffs -----------------------------------------------------
//
// A puff is a single irregular cloudlet with filament structure and a
// radial falloff so its edges dissolve into nothing. The nebula is built
// by scattering several dozen of these through 3D space rather than by
// blowing up one full-frame cloud texture: at 4K a stretched full-frame
// texture turns to mush as the camera pushes in, while individually
// placed puffs stay near their native resolution and keep their
// filaments crisp.
//
// Colour lives in RGB and density in alpha, because the puffs are
// composited additively ("lighter") over a near-black sky.
const bakePuff = (size: number, seed: number, tint: Rgb, accent: Rgb) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      const dx = u - 0.5;
      const dy = v - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const i = (y * size + x) * 4;
      if (d >= 1) {
        data[i + 3] = 0;
        continue;
      }
      // Soft-shouldered radial envelope, so puffs blend into each other
      // instead of reading as discs.
      const radial = Math.pow(1 - d, 1.7);

      // Domain warp: pushing the sample point around with a second noise
      // field is what turns straight ridges into curling, turbulent
      // strands.
      const wx =
        u * 3.9 + 1.2 * (fbm2D(u * 2.1 + 3.7, v * 2.1 + 1.3, seed + 11, 3) - 0.5);
      const wy =
        v * 3.9 + 1.2 * (fbm2D(u * 2.1 + 9.1, v * 2.1 + 6.4, seed + 29, 3) - 0.5);

      const filament = ridged2D(wx, wy, seed + 3, 5);
      const clump = fbm2D(u * 1.7 + 2.2, v * 1.7 + 8.8, seed + 53, 3);

      // Real nebulae are a diffuse gas body with bright strands running
      // through it, so the density is both: a broad term that follows
      // the filament field gently, plus a high-exponent term that only
      // lights the ridge crests. Strands alone look like wiring; the
      // broad term alone looks like cotton wool.
      const body = 0.26 + 0.30 * filament;
      const strands = 0.85 * Math.pow(filament, 2.8);
      const density = radial * (0.16 + 0.98 * clump) * (body + strands);

      const alpha = clamp01(density * 0.85);
      if (alpha <= 0.004) {
        data[i + 3] = 0;
        continue;
      }

      // Vary hue across the cloud so it isn't one flat colour: dense
      // filaments lean toward the accent, thin veils toward the tint.
      const mix = clamp01(
        fbm2D(u * 1.15 + 5.3, v * 1.15 + 4.1, seed + 77, 2) * 0.7 +
          filament * 0.5,
      );

      data[i] = Math.round(tint.r + (accent.r - tint.r) * mix);
      data[i + 1] = Math.round(tint.g + (accent.g - tint.g) * mix);
      data[i + 2] = Math.round(tint.b + (accent.b - tint.b) * mix);
      data[i + 3] = Math.round(Math.pow(alpha, 1.45) * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
};

// --- Stars ------------------------------------------------------------

// Tight white core plus a wide exponential-ish halo. Drawn additively and
// scaled per star, this reads as a pinprick when small and as soft bokeh
// when a star drifts close to the camera.
const bakeStar = (size: number, tint: Rgb): HTMLCanvasElement => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const c = size / 2;
  const { r, g, b } = tint;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.05, `rgba(${r}, ${g}, ${b}, 0.95)`);
  grad.addColorStop(0.12, `rgba(${r}, ${g}, ${b}, 0.5)`);
  grad.addColorStop(0.26, `rgba(${r}, ${g}, ${b}, 0.17)`);
  grad.addColorStop(0.52, `rgba(${r}, ${g}, ${b}, 0.045)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
};

// Coreless bloom used for the warm knots and for the extra halo layered
// under the brightest stars.
const bakeGlow = (size: number, tint: Rgb): HTMLCanvasElement => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const c = size / 2;
  const { r, g, b } = tint;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
  grad.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, 0.34)`);
  grad.addColorStop(0.42, `rgba(${r}, ${g}, ${b}, 0.1)`);
  grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.025)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
};

export type TextureSet = {
  puffs: HTMLCanvasElement[];
  corePuffs: HTMLCanvasElement[];
  hazePuffs: HTMLCanvasElement[];
  stars: HTMLCanvasElement[];
  warmGlows: HTMLCanvasElement[];
  whiteGlow: HTMLCanvasElement;
};

const cache = new Map<string, TextureSet>();

export type TexturePaletteInput = {
  nebulaTints: string[];
  coreTint: string;
  hazeTint: string;
  warmTints: string[];
  starTints: string[];
};

/**
 * Builds (or returns the cached) texture set for a variant.
 *
 * `resolutionScale` is 1 at 1080p and 2 at 4K; puff textures are baked
 * proportionally larger so the 4K render gains real detail rather than
 * an upscale of the 1080p assets.
 */
export const getTextures = (
  variantKey: string,
  palette: TexturePaletteInput,
  resolutionScale: number,
): TextureSet => {
  const texScale = Math.min(2, Math.max(1, resolutionScale));
  const key = `${variantKey}@${texScale}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const puffSize = Math.round(512 * texScale);
  const hazeSize = Math.round(384 * texScale);
  const spriteSize = Math.round(128 * texScale);

  const tints = palette.nebulaTints.map(hexToRgb);
  const core = hexToRgb(palette.coreTint);
  const haze = hexToRgb(palette.hazeTint);

  const rand = mulberry32(90210);

  const puffs: HTMLCanvasElement[] = [];
  for (let i = 0; i < 6; i++) {
    const tint = tints[i % tints.length];
    const accent = tints[(i + 2 + Math.floor(rand() * 2)) % tints.length];
    puffs.push(bakePuff(puffSize, 1000 + i * 37, tint, accent));
  }

  const corePuffs: HTMLCanvasElement[] = [];
  for (let i = 0; i < 3; i++) {
    corePuffs.push(
      bakePuff(puffSize, 4000 + i * 53, tints[(i * 2) % tints.length], core),
    );
  }

  const hazePuffs: HTMLCanvasElement[] = [];
  for (let i = 0; i < 2; i++) {
    hazePuffs.push(bakePuff(hazeSize, 7000 + i * 71, haze, tints[i % tints.length]));
  }

  const stars = palette.starTints.map((hex) =>
    bakeStar(spriteSize, hexToRgb(hex)),
  );
  const warmGlows = palette.warmTints.map((hex) =>
    bakeGlow(spriteSize * 2, hexToRgb(hex)),
  );
  const whiteGlow = bakeGlow(spriteSize * 2, { r: 210, g: 232, b: 255 });

  const set: TextureSet = {
    puffs,
    corePuffs,
    hazePuffs,
    stars,
    warmGlows,
    whiteGlow,
  };
  cache.set(key, set);
  return set;
};
