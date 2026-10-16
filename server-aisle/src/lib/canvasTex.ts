import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  NoColorSpace,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: false })!;
  return { canvas: c, ctx };
};

/** Mipmapped, max-anisotropy texture from a canvas (drawn once). */
export const canvasTexture = (
  gl: WebGLRenderer,
  canvas: HTMLCanvasElement,
  srgb: boolean,
): Texture => {
  const t = new CanvasTexture(canvas);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
  t.needsUpdate = true;
  return t;
};
