/**
 * Grain + dither for the Canvas 2D looks. Same integer hash (pcg3d) and
 * the same amounts as the GLSL pass in lib/three/grainShader.ts: triangular
 * luminance grain of ±`amount` plus ±1/255 dither, as a pure function of
 * pixel position and the (looped) frame number.
 */

const pcg3d = (x0: number, y0: number, z0: number, out: Uint32Array) => {
  let x = (Math.imul(x0, 1664525) + 1013904223) >>> 0;
  let y = (Math.imul(y0, 1664525) + 1013904223) >>> 0;
  let z = (Math.imul(z0, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  y = (y ^ (y >>> 16)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  out[0] = x;
  out[1] = y;
  out[2] = z;
};

/** Writes grain into the canvas in place (device pixels). */
export const applyGrain2D = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  amount = 0.02,
) => {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const h = new Uint32Array(3);
  const g = amount * 255;
  const inv = 1 / 16777216;
  for (let py = 0; py < height; py++) {
    // gl_FragCoord.y counts from the bottom; mirror it so both passes agree.
    const fy = height - 1 - py;
    for (let px = 0; px < width; px++) {
      pcg3d(px, fy, frame, h);
      const r0 = (h[0] >>> 8) * inv;
      const r1 = (h[1] >>> 8) * inv;
      const r2 = (h[2] >>> 8) * inv;
      const n = (r0 + r1 - 1) * g + (r2 - 0.5) * 2;
      const i = (py * width + px) * 4;
      d[i] = d[i] + n + 0.5; // Uint8ClampedArray rounds and clamps
      d[i + 1] = d[i + 1] + n + 0.5;
      d[i + 2] = d[i + 2] + n + 0.5;
    }
  }
  ctx.putImageData(img, 0, 0);
};

/**
 * Grain as a separate RGBA layer for looks drawn in SVG/HTML: white or
 * black at low alpha, normal blending, composited on top.
 */
export const drawGrainOverlay = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  amount = 0.02,
) => {
  const { width, height } = ctx.canvas;
  const img = ctx.createImageData(width, height);
  const d = img.data;
  const h = new Uint32Array(3);
  const inv = 1 / 16777216;
  for (let py = 0; py < height; py++) {
    const fy = height - 1 - py;
    for (let px = 0; px < width; px++) {
      pcg3d(px, fy, frame, h);
      const r0 = (h[0] >>> 8) * inv;
      const r1 = (h[1] >>> 8) * inv;
      const r2 = (h[2] >>> 8) * inv;
      // grain in [-amount, amount] plus +-1/255 dither, as an alpha of white/black
      const n = (r0 + r1 - 1) * amount + (r2 - 0.5) * (2 / 255);
      const i = (py * width + px) * 4;
      const v = n > 0 ? 255 : 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = Math.abs(n) * 255 + 0.5;
    }
  }
  ctx.putImageData(img, 0, 0);
};
