import { Texture } from "pixi.js";

// Every sprite texture is generated procedurally at setup time, so the project
// has no binary asset dependencies and the 4K pass gets textures authored at
// 4K rather than upscaled 1080p ones.

const makeCanvas = (size: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

/** Round-to-power-of-two, so the generated textures stay GPU friendly. */
const pot = (n: number) => {
  let p = 4;
  while (p < n) p *= 2;
  return Math.min(p, 1024);
};

/**
 * Soft circular glow. `core` controls how much of the radius stays at full
 * brightness before the falloff starts -- 0 reads as a nebulous blob, 0.3 as a
 * defined dot with a halo.
 */
export const glowTexture = (radiusPx: number, core = 0.12, falloff = 2.2) => {
  const size = pot(radiusPx * 2);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const c = size / 2;
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - c) / c;
      const dy = (y + 0.5 - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      let a = 0;
      if (d < 1) {
        const t = d <= core ? 1 : 1 - (d - core) / (1 - core);
        a = Math.pow(Math.max(t, 0), falloff);
      }
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(canvas);
};

/**
 * A glinting star: a bright core with four diffraction spikes. This is the
 * shape that reads as "sparkle" in the gold plates.
 */
export const starTexture = (radiusPx: number, spikeLength = 1, arms = 4) => {
  const size = pot(radiusPx * 2);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const c = size / 2;
  const img = ctx.createImageData(size, size);
  const spikeWidth = 0.012 / Math.max(spikeLength, 0.001);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - c) / c;
      const dy = (y + 0.5 - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);

      // Core.
      let a = Math.pow(Math.max(1 - d / 0.3, 0), 2.6);

      // Spikes: a narrow ridge along each axis, fading with distance.
      if (d < 1) {
        const fall = Math.pow(Math.max(1 - d, 0), 2.0);
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        a += (spikeWidth / (spikeWidth + ay * ay)) * fall * 0.9;
        a += (spikeWidth / (spikeWidth + ax * ax)) * fall * 0.9;
        if (arms === 8) {
          const u = (dx + dy) * 0.7071;
          const v = (dx - dy) * 0.7071;
          a += (spikeWidth / (spikeWidth + v * v)) * fall * 0.35;
          a += (spikeWidth / (spikeWidth + u * u)) * fall * 0.35;
        }
      }

      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(a, 1) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(canvas);
};

/**
 * A vertical dot-dash column used to build the falling "rain" strands. The
 * pattern is drawn to tile seamlessly so a TilingSprite can scroll forever.
 */
export const strandTexture = (
  height: number,
  seed: number,
  dotSpacing = 14,
) => {
  const width = 8;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, width, height);

  // Deterministic per-strand dot pattern.
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const rows = Math.max(2, Math.round(height / dotSpacing));
  const step = height / rows; // exact division keeps the tile seamless
  for (let i = 0; i < rows; i++) {
    if (rnd() < 0.22) continue; // gaps make the strand read as dashes
    const y = i * step + step * 0.5;
    const r = 0.7 + rnd() * 1.5;
    const a = 0.35 + rnd() * 0.65;
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(width / 2, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = Texture.from(canvas);
  tex.source.addressMode = "repeat";
  return tex;
};

/** Horizontal soft-edged streak, for the hot core of the gold energy band. */
export const streakTexture = (width = 256, height = 32) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const img = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const dy = (y + 0.5 - height / 2) / (height / 2);
    const vertical = Math.pow(Math.max(1 - Math.abs(dy), 0), 3.0);
    for (let x = 0; x < width; x++) {
      const dx = (x + 0.5 - width / 2) / (width / 2);
      const horizontal = Math.pow(Math.max(1 - dx * dx, 0), 1.4);
      const i = (y * width + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(vertical * horizontal * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(canvas);
};

/**
 * A vertical black ramp used to sink the bottom of frame, matching the way the
 * reference plates fade their falling particles out before they land.
 */
export const verticalFadeTexture = (
  stops: { at: number; alpha: number }[],
  height = 512,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  for (const stop of stops) {
    gradient.addColorStop(stop.at, `rgba(0, 0, 0, ${stop.alpha})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, height);
  return Texture.from(canvas);
};
