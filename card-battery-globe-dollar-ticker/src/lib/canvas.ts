import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  return { c, ctx };
};

/** Wraps a canvas in a mipmapped, anisotropic texture. */
export const canvasTexture = (
  c: HTMLCanvasElement,
  gl: WebGLRenderer,
  opts: { srgb?: boolean; repeat?: boolean; aniso?: number } = {},
): Texture => {
  const t = new CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? NoColorSpace : SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = Math.min(opts.aniso ?? 1, gl.capabilities.getMaxAnisotropy());
  if (opts.repeat) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
  }
  t.needsUpdate = true;
  return t;
};

/** Height canvas (white = raised) → tangent-space normal map canvas. */
export const heightToNormal = (src: HTMLCanvasElement, strength: number) => {
  const w = src.width;
  const h = src.height;
  const sd = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  const { c, ctx } = makeCanvas(w, h);
  const out = ctx.createImageData(w, h);
  const H = (x: number, y: number) => {
    x = Math.min(w - 1, Math.max(0, x));
    y = Math.min(h - 1, Math.max(0, y));
    return sd[(y * w + x) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      // canvas y runs down; texture v runs up → flip dy
      let nx = -dx;
      let ny = dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * w + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
};

export const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
