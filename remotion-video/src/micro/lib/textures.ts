// Procedural surface maps, drawn into a 2D canvas and uploaded as textures.
//
// Fine surface detail -- membrane pores, protein threads, the woven look of
// the fibrous microbes -- lives in bump maps rather than in geometry. That
// keeps triangle counts sane in the dense shots, and, more importantly, it
// works identically on all three renderer tiers: a procedural bump written as
// shader code would need a GLSL version for WebGL and a TSL version for
// WebGPU, whereas a baked texture is just a texture everywhere.

import { CanvasTexture, RepeatWrapping, type Texture } from "three";
import { createNoise3D, fbm } from "./noise";

export type SurfaceStyle = "membrane" | "fibrous" | "pebbled" | "smooth";

const TEX_W = 512;
const TEX_H = 256;

/**
 * Samples a noise field in spherical coordinates so the map wraps seamlessly
 * around a sphere in longitude and does not tear at the UV seam.
 */
const bakeSphericalBump = (
  style: SurfaceStyle,
  seed: number,
  scale: number,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const noise = createNoise3D(seed);
  const image = ctx.createImageData(TEX_W, TEX_H);
  const data = image.data;

  for (let y = 0; y < TEX_H; y++) {
    const phi = (y / (TEX_H - 1)) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let x = 0; x < TEX_W; x++) {
      const theta = (x / TEX_W) * Math.PI * 2;
      const nx = sinPhi * Math.cos(theta) * scale;
      const ny = cosPhi * scale;
      const nz = sinPhi * Math.sin(theta) * scale;

      let v: number;
      switch (style) {
        case "fibrous": {
          // Ridged noise reads as tangled threads rather than soft lumps.
          const r = 1 - Math.abs(fbm(noise, nx, ny, nz, 5, 2.1, 0.55));
          v = Math.pow(r, 2.2);
          break;
        }
        case "pebbled": {
          // Two offset fields beat against each other into rounded cobbles.
          const a = fbm(noise, nx, ny, nz, 3, 2, 0.5);
          const b = fbm(noise, nx + 31.4, ny + 17.2, nz + 8.9, 2, 2, 0.5);
          v = 0.5 + 0.5 * Math.sin((a + b) * 6.0);
          v = Math.pow(v, 1.6);
          break;
        }
        case "membrane": {
          const a = fbm(noise, nx, ny, nz, 4, 2, 0.5);
          v = 0.5 + 0.5 * a;
          break;
        }
        default: {
          const a = fbm(noise, nx * 0.4, ny * 0.4, nz * 0.4, 2, 2, 0.5);
          v = 0.5 + 0.25 * a;
          break;
        }
      }

      const c = Math.max(0, Math.min(255, Math.round(v * 255)));
      const i = (y * TEX_W + x) * 4;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
};

export const createBumpTexture = (
  style: SurfaceStyle,
  seed: number,
  scale = 3,
): Texture => {
  const texture = new CanvasTexture(bakeSphericalBump(style, seed, scale));
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
};

/** Soft round alpha blob, used for out-of-focus specks and haze sprites. */
export const createSoftDotTexture = (
  falloff = 2.0,
  core = 0.0,
): Texture => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const image = ctx.createImageData(size, size);
    const data = image.data;
    const c = (size - 1) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - c) / c;
        const dy = (y - c) / c;
        const d = Math.sqrt(dx * dx + dy * dy);
        const a = d >= 1 ? 0 : Math.pow(1 - d, falloff) + core * (1 - d);
        const i = (y * size + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};
