import * as THREE from "three";
import { mulberry32 } from "../random";

/**
 * Data read-out drawn on the glass panels: a small numeric header, columns
 * of short bars (gel / barcode-like) and one bright vertical marker bar.
 * Drawn once per variant with Canvas 2D and uploaded as a texture.
 */
export const createGlyphTexture = (seed: number) => {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rnd = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);

  // header numerics
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 44px monospace";
  const num = () => `${Math.floor(rnd() * 90 + 10)}.${Math.floor(rnd() * 90 + 10)}`;
  ctx.fillText(`${num()}  ${num()}`, 90, 130);
  ctx.fillRect(90, 150, 230, 4);

  // gel / barcode columns
  const cols = 9;
  const x0 = 90;
  const colW = (size - 180) / cols;
  const marker = Math.floor(rnd() * cols);
  for (let c = 0; c < cols; c++) {
    const cx = x0 + c * colW;
    if (c === marker) {
      // bright vertical bar with a gap
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      const gap = 300 + rnd() * 300;
      ctx.fillRect(cx + colW * 0.3, 200, colW * 0.24, gap - 200);
      ctx.fillRect(cx + colW * 0.3, gap + 40, colW * 0.24, 900 - gap - 40);
      continue;
    }
    let y = 200 + rnd() * 30;
    while (y < 900) {
      const h = 9 + rnd() * 12;
      const w = colW * (0.3 + rnd() * 0.5);
      const a = 0.35 + rnd() * 0.65;
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.fillRect(cx + (colW - w) * 0.3, y, w, h);
      y += h + 8 + rnd() * 26;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
};
