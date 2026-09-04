// Sky gradient, large-scale mottling and the Milky Way band. All of it is
// static — the sky in the reference does not move — so this is drawn once into
// an offscreen canvas and blitted per frame.
import {
  BAND_BUFFER_DIVISOR,
  BAND_CORE_COLOR,
  BAND_EDGE_COLOR,
  BAND_END,
  BAND_HALF_WIDTH,
  BAND_OPACITY,
  BAND_START,
  SKY_HORIZON,
  SKY_TOP,
} from "./constants";
import { clamp01, fbm, makeNoise2D, smoothstep } from "./noise";

export type BandGeometry = {
  originX: number;
  originY: number;
  dirX: number;
  dirY: number;
  halfWidth: number;
};

export const makeBandGeometry = (
  width: number,
  height: number,
): BandGeometry => {
  const x0 = BAND_START.x * width;
  const y0 = BAND_START.y * height;
  const dx = BAND_END.x * width - x0;
  const dy = BAND_END.y * height - y0;
  const len = Math.hypot(dx, dy);
  return {
    originX: x0,
    originY: y0,
    dirX: dx / len,
    dirY: dy / len,
    halfWidth: BAND_HALF_WIDTH * height,
  };
};

// Distance from the band axis, normalised so 1 = one half-width out.
export const bandOffset = (band: BandGeometry, x: number, y: number) => {
  const relX = x - band.originX;
  const relY = y - band.originY;
  // Perpendicular component of rel against the band direction.
  const across = relX * -band.dirY + relY * band.dirX;
  return across / band.halfWidth;
};

// 1 on the band axis, falling off to ~0 at the band edges. Used both to draw
// the band and to bias star density toward it.
export const bandWeight = (band: BandGeometry, x: number, y: number) => {
  const t = bandOffset(band, x, y);
  return Math.exp(-2.4 * t * t);
};

export const drawSky = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, SKY_TOP);
  gradient.addColorStop(0.5, "#051432");
  gradient.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawMottling(ctx, width, height, seed);
  drawMilkyWay(ctx, width, height, seed);
};

// Very subtle large-scale variation so the gradient isn't mathematically flat.
const drawMottling = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
) => {
  const noise = makeNoise2D(seed + 17);
  const bw = Math.max(2, Math.round(width / 64));
  const bh = Math.max(2, Math.round(height / 64));
  const buffer = ctx.createImageData(bw, bh);
  const data = buffer.data;
  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const n = fbm(noise, (px / bw) * 3.1, (py / bh) * 2.2, 3);
      const i = (py * bw + px) * 4;
      // Signed: lighten where the noise is high, deepen where it is low.
      const signed = (n - 0.5) * 2;
      const value = signed > 0 ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = Math.round(Math.abs(signed) * 255 * 0.028);
    }
  }
  blitSmoothed(ctx, buffer, bw, bh, width, height, 1);
};

const drawMilkyWay = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
) => {
  const band = makeBandGeometry(width, height);
  const cloud = makeNoise2D(seed + 101);
  const dust = makeNoise2D(seed + 211);

  const bw = Math.max(4, Math.round(width / BAND_BUFFER_DIVISOR));
  const bh = Math.max(4, Math.round(height / BAND_BUFFER_DIVISOR));
  const buffer = ctx.createImageData(bw, bh);
  const data = buffer.data;

  // Noise is sampled in band space, slow along the band axis and much faster
  // across it. That anisotropy is what makes the cloud read as drawn-out
  // filaments rather than as blobs of weather.
  const alongScale = 1 / (0.5 * width);
  const acrossScale = 1 / (0.045 * height);

  for (let py = 0; py < bh; py++) {
    const y = ((py + 0.5) / bh) * height;
    for (let px = 0; px < bw; px++) {
      const x = ((px + 0.5) / bw) * width;
      const relX = x - band.originX;
      const relY = y - band.originY;
      const along = relX * band.dirX + relY * band.dirY;
      const across = relX * -band.dirY + relY * band.dirX;
      const t = across / band.halfWidth;
      const falloff = Math.exp(-2.4 * t * t);

      const u = along * alongScale;
      const v = across * acrossScale;
      const cloudN = fbm(cloud, u, v, 5);
      const dustN = fbm(dust, u * 1.9 + 31.4, v * 0.9 + 17.9, 4);
      const lane = smoothstep(0.42, 0.62, dustN);

      const intensity = clamp01(
        falloff * (0.22 + 1.05 * cloudN) * (1 - 0.72 * lane),
      );
      // Violet in the dense core, cooler and paler toward the edges.
      const mix = clamp01(falloff);
      const i = (py * bw + px) * 4;
      data[i] = Math.round(
        BAND_EDGE_COLOR[0] + (BAND_CORE_COLOR[0] - BAND_EDGE_COLOR[0]) * mix,
      );
      data[i + 1] = Math.round(
        BAND_EDGE_COLOR[1] + (BAND_CORE_COLOR[1] - BAND_EDGE_COLOR[1]) * mix,
      );
      data[i + 2] = Math.round(
        BAND_EDGE_COLOR[2] + (BAND_CORE_COLOR[2] - BAND_EDGE_COLOR[2]) * mix,
      );
      data[i + 3] = Math.round(intensity * 255 * BAND_OPACITY);
    }
  }

  blitSmoothed(ctx, buffer, bw, bh, width, height, 1);
};

// ImageData can only be put 1:1, so stage it on a small canvas and scale that
// up with smoothing on — which is also what keeps the band soft.
const blitSmoothed = (
  ctx: CanvasRenderingContext2D,
  buffer: ImageData,
  bw: number,
  bh: number,
  width: number,
  height: number,
  alpha: number,
) => {
  const staging = document.createElement("canvas");
  staging.width = bw;
  staging.height = bh;
  const sctx = staging.getContext("2d");
  if (!sctx) return;
  sctx.putImageData(buffer, 0, 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(staging, 0, 0, bw, bh, 0, 0, width, height);
  ctx.restore();
};
