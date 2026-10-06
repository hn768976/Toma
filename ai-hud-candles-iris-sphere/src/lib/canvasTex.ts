import * as THREE from "three";

export type CanvasTex = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  key: string | number | null; // what the canvas currently shows
};

// colour: true -> sRGB colour texture; false -> raw data (masks, parameters).
export const makeCanvasTex = (w: number, h: number, colour: boolean, mipmaps = true): CanvasTex => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  // willReadFrequently keeps the canvas on Chrome's software rasteriser. The
  // GPU canvas path rasterises glyphs slightly differently depending on its
  // glyph-cache state, which broke byte-for-byte determinism between a warm
  // tab and a cold one (±1 on a few text pixels).
  const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true })!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.generateMipmaps = mipmaps;
  tex.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // Colour canvases are uploaded premultiplied so filtering has no dark fringes;
  // shaders treat their rgb as premultiplied.
  tex.premultiplyAlpha = colour;
  return { canvas, ctx, tex, key: null };
};

// Redraw the whole canvas from scratch when what it should show changes.
// `key` must be a pure function of the frame; `draw` must paint everything.
export const redraw = (ct: CanvasTex, key: string | number, draw: (ctx: CanvasRenderingContext2D) => void) => {
  if (ct.key === key) return;
  ct.ctx.setTransform(1, 0, 0, 1, 0, 0);
  ct.ctx.clearRect(0, 0, ct.canvas.width, ct.canvas.height);
  ct.ctx.globalAlpha = 1;
  ct.ctx.globalCompositeOperation = "source-over";
  draw(ct.ctx);
  ct.key = key;
  ct.tex.needsUpdate = true;
};

export const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};
