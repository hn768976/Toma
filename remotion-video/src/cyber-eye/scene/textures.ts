import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from "three/webgpu";

// All sprite textures are generated procedurally at load time, so the project
// has no binary image assets and every render is pixel-identical.

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }
  return { canvas, ctx };
};

const toTexture = (canvas: HTMLCanvasElement) => {
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
};

/** Soft round dot with a gaussian-ish falloff. Used for the particle cloud. */
export const makeSoftDotTexture = (size = 64) => {
  const { canvas, ctx } = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const v = Math.max(0, 1 - d);
      const a = Math.pow(v, 2.2);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(a * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
};

/** Lens-flare style glow: hot core, wide halo and a horizontal anamorphic streak. */
export const makeFlareTexture = (size = 256) => {
  const { canvas, ctx } = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const core = Math.exp(-d * d * 60);
      const halo = Math.exp(-d * d * 6) * 0.35;
      const streak =
        Math.exp(-dy * dy * 900) * Math.max(0, 1 - Math.abs(dx)) ** 1.6 * 0.55;
      const v = Math.min(1, core + halo + streak);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
};

/** Wide horizontal light streak that fades at both ends and vertically. */
export const makeStreakTexture = (w = 512, h = 64) => {
  const { canvas, ctx } = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const dy = (y - (h - 1) / 2) / ((h - 1) / 2);
    const vy = Math.exp(-dy * dy * 5);
    for (let x = 0; x < w; x++) {
      const dx = (x - (w - 1) / 2) / ((w - 1) / 2);
      const vx = Math.max(0, 1 - Math.abs(dx)) ** 1.3;
      const v = vx * vy;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
};
