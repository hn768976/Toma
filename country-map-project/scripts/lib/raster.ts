/**
 * Raster pre-warping.
 *
 * The relief base is an equirectangular global grayscale raster; the map is a
 * Mercator or Lambert conformal conic projection. Rather than reproject at
 * render time, each country's relief is warped once here into exactly the
 * composition's pixel grid, so the raster and the SVG vectors are registered by
 * construction and the push-in scales them together.
 */

import type {GeoProjection} from 'd3-geo';

export interface GrayRaster {
  data: Uint8Array;
  width: number;
  height: number;
}

export type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

/** Source grayscale levels that map to the palette's dark and light endpoints.
 *  Measured from GRAY_HR_SR_W: ocean sits flat at 106, land runs ~72-250. */
export const RELIEF_SRC_LO = 96;
export const RELIEF_SRC_HI = 238;

interface WarpOptions {
  projection: GeoProjection;
  /** Composition size the projection was fitted to. */
  frameWidth: number;
  frameHeight: number;
  outWidth: number;
  outHeight: number;
  /** Palette endpoints: dark = deepest shading, light = flat ground. */
  dark: RGB;
  light: RGB;
  /** Grid step in output pixels for the inverse projection. */
  gridStep?: number;
}

/**
 * Warp + colourise in one pass.
 *
 * The inverse projection is evaluated on a coarse grid and bilinearly
 * interpolated between nodes — map projections are smooth at this scale, and it
 * turns ~12M inverse calls into ~200k without any visible difference.
 */
export const warpRelief = (src: GrayRaster, opts: WarpOptions): Buffer => {
  const {
    projection,
    frameWidth,
    frameHeight,
    outWidth,
    outHeight,
    dark,
    light,
    gridStep = 8,
  } = opts;

  const gx = Math.ceil(outWidth / gridStep) + 1;
  const gy = Math.ceil(outHeight / gridStep) + 1;
  const nodeX = new Float64Array(gx * gy);
  const nodeY = new Float64Array(gx * gy);
  const nodeOk = new Uint8Array(gx * gy);

  const sx = frameWidth / outWidth;
  const sy = frameHeight / outHeight;
  const lonToPx = src.width / 360;
  const latToPx = src.height / 180;

  for (let j = 0; j < gy; j++) {
    let refLon = NaN;
    for (let i = 0; i < gx; i++) {
      const px = Math.min(i * gridStep, outWidth) * sx;
      const py = Math.min(j * gridStep, outHeight) * sy;
      const inv = projection.invert?.([px, py]);
      const k = j * gx + i;
      if (!inv || !Number.isFinite(inv[0]) || !Number.isFinite(inv[1])) {
        nodeOk[k] = 0;
        continue;
      }
      let [lon, lat] = inv;
      // Keep longitude continuous along the row so a cell that straddles the
      // antimeridian interpolates across it instead of racing back round the globe.
      if (Number.isFinite(refLon)) {
        while (lon - refLon > 180) lon -= 360;
        while (refLon - lon > 180) lon += 360;
      }
      refLon = lon;
      nodeX[k] = (lon + 180) * lonToPx;
      nodeY[k] = (90 - lat) * latToPx;
      nodeOk[k] = 1;
    }
  }

  const out = Buffer.alloc(outWidth * outHeight * 3);
  const range = RELIEF_SRC_HI - RELIEF_SRC_LO;
  const dr = light[0] - dark[0];
  const dg = light[1] - dark[1];
  const db = light[2] - dark[2];

  const sample = (fx: number, fy: number): number => {
    let x = fx % src.width;
    if (x < 0) x += src.width;
    const y = Math.max(0, Math.min(src.height - 1.0001, fy));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const x1 = (x0 + 1) % src.width;
    const y1 = Math.min(y0 + 1, src.height - 1);
    const r0 = y0 * src.width;
    const r1 = y1 * src.width;
    const a = src.data[r0 + x0];
    const b = src.data[r0 + x1];
    const c = src.data[r1 + x0];
    const d = src.data[r1 + x1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };

  for (let y = 0; y < outHeight; y++) {
    const gj = Math.min(Math.floor(y / gridStep), gy - 2);
    const fy = y / gridStep - gj;
    for (let x = 0; x < outWidth; x++) {
      const gi = Math.min(Math.floor(x / gridStep), gx - 2);
      const fx = x / gridStep - gi;
      const k00 = gj * gx + gi;
      const k10 = k00 + 1;
      const k01 = k00 + gx;
      const k11 = k01 + 1;
      const o = (y * outWidth + x) * 3;
      if (!nodeOk[k00] || !nodeOk[k10] || !nodeOk[k01] || !nodeOk[k11]) {
        out[o] = light[0];
        out[o + 1] = light[1];
        out[o + 2] = light[2];
        continue;
      }
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const px = nodeX[k00] * w00 + nodeX[k10] * w10 + nodeX[k01] * w01 + nodeX[k11] * w11;
      const py = nodeY[k00] * w00 + nodeY[k10] * w10 + nodeY[k01] * w01 + nodeY[k11] * w11;
      let t = (sample(px, py) - RELIEF_SRC_LO) / range;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      out[o] = dark[0] + dr * t;
      out[o + 1] = dark[1] + dg * t;
      out[o + 2] = dark[2] + db * t;
    }
  }
  return out;
};

/**
 * Source pixels consumed per output pixel at the frame centre. Used to size the
 * warped output so it neither throws away detail nor stores pure upscale.
 */
export const sourceDensity = (
  projection: GeoProjection,
  frameWidth: number,
  frameHeight: number,
  srcWidth: number,
  srcHeight: number
): number => {
  const cx = frameWidth / 2;
  const cy = frameHeight / 2;
  const p0 = projection.invert?.([cx, cy]);
  const px = projection.invert?.([cx + 1, cy]);
  const py = projection.invert?.([cx, cy + 1]);
  if (!p0 || !px || !py) return 1;
  const dx = Math.hypot(
    ((px[0] - p0[0]) * srcWidth) / 360,
    ((px[1] - p0[1]) * srcHeight) / 180
  );
  const dy = Math.hypot(
    ((py[0] - p0[0]) * srcWidth) / 360,
    ((py[1] - p0[1]) * srcHeight) / 180
  );
  return Math.max(dx, dy);
};
