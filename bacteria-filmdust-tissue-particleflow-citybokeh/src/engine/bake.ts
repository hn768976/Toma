import { CanvasSource, Texture } from "pixi.js";

// Prebaked sprite textures. Built once with Canvas 2D (deterministic for a
// given browser) and uploaded with mipmaps so they shrink without aliasing.

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext("2d", { willReadFrequently: false })!;
  return { c, g };
};

export const canvasTexture = (c: HTMLCanvasElement, mip = true) =>
  new Texture({
    source: new CanvasSource({
      resource: c,
      autoGenerateMipmaps: mip,
      scaleMode: "linear",
      mipmapFilter: "linear",
      alphaMode: "premultiply-alpha-on-upload",
    }),
  });

/** A copy of `src` blurred by `px` pixels (Canvas 2D filter), with padding. */
export const blurred = (src: HTMLCanvasElement, px: number) => {
  if (px <= 0.01) return src;
  const pad = Math.ceil(px * 3);
  const { c, g } = makeCanvas(src.width + pad * 2, src.height + pad * 2);
  g.filter = `blur(${px}px)`;
  g.drawImage(src, pad, pad);
  return c;
};
