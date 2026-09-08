/**
 * Small procedural textures, generated once per page and cached. Nothing
 * here is loaded from disk, so there is no asset to license and no
 * delayRender() to manage.
 */

import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

const makeCanvas = (size: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

/** Soft radial falloff used for the LED haloes and the contact shadows. */
export const radialTexture = (falloff: number) => {
  const key = `radial-${falloff}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.pow(1 - t, falloff);
    g.addColorStop(t, `rgba(255,255,255,${a.toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
};

/** Perforated floor vent: a fine dot pattern on transparent ground. */
export const ventTexture = () => {
  const key = "vent";
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  const cells = 13;
  const step = size / cells;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const cx = (i + 0.5) * step;
      const cy = (j + 0.5) * step;
      // Leave a plain border so the perforation reads as a panel insert.
      if (i === 0 || j === 0 || i === cells - 1 || j === cells - 1) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, step * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
};

let grainUrl: string | null = null;

/**
 * A tileable noise tile, rendered once and then scrolled per frame by the
 * overlay. Far cheaper than an SVG turbulence filter at 4K.
 */
export const grainDataUrl = () => {
  if (grainUrl) return grainUrl;
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  let a = 0x9e3779b9;
  for (let i = 0; i < size * size; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const v = ((t ^ (t >>> 14)) >>> 0) % 256;
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainUrl = canvas.toDataURL("image/png");
  return grainUrl;
};
