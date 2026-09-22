import { staticFile } from "remotion";
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from "three";
import {
  CELL_H,
  CELL_W,
  COLS,
  FONT_PX,
  GLYPH_BLOCK,
  GLYPH_ZERO,
  ROWS,
  TEX_H,
  TEX_W,
  brightness,
  glyphs,
} from "./digitField";

const FONT_FAMILY = "DataCableMono";

let fontPromise: Promise<void> | null = null;

const loadFont = () => {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    const face = new FontFace(
      FONT_FAMILY,
      `url(${staticFile("fonts/JetBrainsMono-Regular.woff2")}) format("woff2")`,
    );
    await face.load();
    document.fonts.add(face);
  })();
  return fontPromise;
};

/**
 * Rasterise the binary field to a canvas, once per JS context.
 *
 * Regenerating this per frame would be both slow and -- because the font may
 * resolve at a different moment on each render thread -- non-deterministic.
 */
const buildCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable for the digit field");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  ctx.font = `${FONT_PX}px "${FONT_FAMILY}", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  const blockW = CELL_W * 0.62;
  const blockH = CELL_H * 0.52;

  for (let row = 0; row < ROWS; row++) {
    const cy = row * CELL_H + CELL_H * 0.5;
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      const cx = col * CELL_W + CELL_W * 0.5;
      ctx.globalAlpha = brightness[i];
      if (glyphs[i] === GLYPH_BLOCK) {
        ctx.fillRect(cx - blockW / 2, cy - blockH / 2, blockW, blockH);
      } else {
        ctx.fillText(glyphs[i] === GLYPH_ZERO ? "0" : "1", cx, cy);
      }
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
};

let texturePromise: Promise<CanvasTexture> | null = null;

export const getDigitTexture = (): Promise<CanvasTexture> => {
  if (texturePromise) return texturePromise;
  texturePromise = (async () => {
    await loadFont();
    const texture = new CanvasTexture(buildCanvas());
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  })();
  return texturePromise;
};

