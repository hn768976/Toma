// Pre-warps the Natural Earth 10m shaded-relief plate (SR_HR, plate carree,
// 21600x10800 @ 60px/degree, public domain) into the country's own projection.
//
// Output is a single grayscale plate per country, neutral at 128. Both style
// versions read the same plate and colour it at render time with an SVG
// component transfer, so the relief never has to be baked twice.
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {COMP_WIDTH, COMP_HEIGHT} from './geo.mjs';

export const SRC_WIDTH = 21600;
export const SRC_HEIGHT = 10800;
const PX_PER_DEG = 60;

// SR_HR encodes flat ground and open water as a constant 206; slopes fall away
// from it in both directions. Re-centring on that value is what turns the plate
// into a signed shading term.
const NEUTRAL = 206;

// Relief plate size. 1.33x the 4K composition keeps it supersampled through the
// full 1.18x push-in (3840 * 1.18 = 4531 < 5120), so terrain never softens.
export const PLATE_WIDTH = 5120;
export const PLATE_HEIGHT = 2880;

const cubic = (a, b, c, d, t) => {
  // Catmull-Rom. Bilinear visibly facets when the source is upsampled 2-3x,
  // which is exactly the regime a regional framing puts us in.
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3)
  );
};

export function loadSource(rawPath) {
  const buf = fs.readFileSync(rawPath);
  if (buf.length !== SRC_WIDTH * SRC_HEIGHT) {
    throw new Error(
      `relief source is ${buf.length} bytes, expected ${SRC_WIDTH * SRC_HEIGHT}`,
    );
  }
  return buf;
}

function sample(src, x, y) {
  // x, y in source pixel space; wraps in longitude, clamps in latitude.
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const col = [];
  for (let m = -1; m <= 2; m++) {
    const yy = Math.min(SRC_HEIGHT - 1, Math.max(0, iy + m));
    const row = yy * SRC_WIDTH;
    const v = [];
    for (let n = -1; n <= 2; n++) {
      const xx = ((ix + n) % SRC_WIDTH + SRC_WIDTH) % SRC_WIDTH;
      v.push(src[row + xx]);
    }
    col.push(cubic(v[0], v[1], v[2], v[3], fx));
  }
  return cubic(col[0], col[1], col[2], col[3], fy);
}

const SUBROWS = 4; // vertical supersampling for the coastline

// Scanline-fills projected rings into an 8-bit coverage raster. Used at plate
// resolution to bake the land/water split into the relief plate — which is what
// spares the composition from clipping the relief to a 130k-point path on every
// frame — and again at coarse resolution to work out where a label fits.
export function fillRings(rings, width, height, {
  scaleX,
  scaleY,
  offsetX = 0,
  offsetY = 0,
  subrows = SUBROWS,
} = {}) {
  const SUBROWS = subrows;
  const PLATE_WIDTH = width;
  const PLATE_HEIGHT = height;
  const rows = PLATE_HEIGHT * SUBROWS;
  const buckets = new Array(rows);

  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = (ring[i * 2] - offsetX) * scaleX;
      const ay = (ring[i * 2 + 1] - offsetY) * scaleY;
      const bx = (ring[j * 2] - offsetX) * scaleX;
      const by = (ring[j * 2 + 1] - offsetY) * scaleY;
      if (ay === by) continue;
      const dir = ay < by ? 1 : -1;
      const y0 = Math.min(ay, by);
      const y1 = Math.max(ay, by);
      // Subrow centres are at (r + 0.5) / SUBROWS in plate-pixel space.
      let r0 = Math.ceil(y0 * SUBROWS - 0.5);
      let r1 = Math.ceil(y1 * SUBROWS - 0.5) - 1;
      if (r0 < 0) r0 = 0;
      if (r1 >= rows) r1 = rows - 1;
      const slope = (bx - ax) / (by - ay);
      for (let r = r0; r <= r1; r++) {
        const y = (r + 0.5) / SUBROWS;
        (buckets[r] ??= []).push(ax + (y - ay) * slope, dir);
      }
    }
  }

  const cov = new Float32Array(PLATE_WIDTH * PLATE_HEIGHT);
  const weight = 1 / SUBROWS;
  const xs = [];
  for (let r = 0; r < rows; r++) {
    const b = buckets[r];
    if (!b) continue;
    buckets[r] = null;
    xs.length = 0;
    for (let i = 0; i < b.length; i += 2) xs.push([b[i], b[i + 1]]);
    xs.sort((p, q) => p[0] - q[0]);

    const base = (r / SUBROWS | 0) * PLATE_WIDTH;
    let winding = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      winding += xs[i][1];
      if (winding === 0) continue;
      let sx = xs[i][0];
      let ex = xs[i + 1][0];
      if (ex <= 0 || sx >= PLATE_WIDTH) continue;
      if (sx < 0) sx = 0;
      if (ex > PLATE_WIDTH) ex = PLATE_WIDTH;
      const first = Math.floor(sx);
      const last = Math.floor(ex - 1e-9);
      if (first === last) {
        cov[base + first] += (ex - sx) * weight;
        continue;
      }
      cov[base + first] += (first + 1 - sx) * weight;
      for (let x = first + 1; x < last; x++) cov[base + x] += weight;
      cov[base + last] += (ex - last) * weight;
    }
  }

  const mask = Buffer.alloc(PLATE_WIDTH * PLATE_HEIGHT);
  for (let i = 0; i < mask.length; i++) {
    const v = cov[i];
    mask[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  }
  return mask;
}

export const rasteriseLandMask = (rings, width = PLATE_WIDTH, height = PLATE_HEIGHT) =>
  fillRings(rings, width, height, {
    scaleX: width / COMP_WIDTH,
    scaleY: height / COMP_HEIGHT,
  });

// Morphological gradient of the land mask: the set of pixels that sit on the
// land/water boundary. Baked as its own channel so the shoreline is a hairline
// in the plate rather than a 110k-point SVG stroke re-rasterised every frame.
export function shoreChannel(mask, radius = 1.6, W = PLATE_WIDTH, H = PLATE_HEIGHT) {
  const PLATE_WIDTH = W;
  const PLATE_HEIGHT = H;
  const shore = Buffer.alloc(PLATE_WIDTH * PLATE_HEIGHT);
  const r = Math.ceil(radius);
  for (let y = 0; y < PLATE_HEIGHT; y++) {
    for (let x = 0; x < PLATE_WIDTH; x++) {
      const at = y * PLATE_WIDTH + x;
      let lo = 255;
      let hi = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= PLATE_HEIGHT) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= PLATE_WIDTH) continue;
          if (dx * dx + dy * dy > radius * radius) continue;
          const v = mask[yy * PLATE_WIDTH + xx];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      shore[at] = hi - lo;
    }
  }
  return shore;
}

// Same warp at an arbitrary size, for the small plates the territory insets use.
export function warpReliefAt(src, projection, width, height, opts) {
  return warpRelief(src, projection, {...opts, width, height});
}

export function warpRelief(
  src,
  projection,
  {gain = 1.7, mask = null, shore = null, width = PLATE_WIDTH, height = PLATE_HEIGHT} = {},
) {
  const png = new PNG({
    width,
    height,
    // Three data channels, no alpha: R = relief shading (neutral 128),
    // G = shoreline ink, B = land coverage. The composition turns each into a
    // colour and an alpha with an feColorMatrix, so one plate serves both
    // style versions.
    colorType: 2,
    inputColorType: 2,
    bitDepth: 8,
  });
  const out = Buffer.alloc(width * height * 3);
  png.data = out;
  const sx = COMP_WIDTH / PLATE_WIDTH;
  const sy = COMP_HEIGHT / PLATE_HEIGHT;

  for (let j = 0; j < PLATE_HEIGHT; j++) {
    const cy = (j + 0.5) * sy;
    for (let i = 0; i < PLATE_WIDTH; i++) {
      const at = j * PLATE_WIDTH + i;
      const cover = mask ? mask[at] : 255;
      const edge = shore ? shore[at] : 0;
      let g = 128;
      // Ocean in SR_HR is a flat plate; only land pixels are worth inverting.
      if (cover > 0) {
        const p = projection.invert([(i + 0.5) * sx, cy]);
        if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
          const lon = ((p[0] + 180) % 360 + 360) % 360 - 180;
          const lat = Math.max(-90, Math.min(90, p[1]));
          const v = sample(
            src,
            (lon + 180) * PX_PER_DEG - 0.5,
            (90 - lat) * PX_PER_DEG - 0.5,
          );
          g = Math.round(128 + (v - NEUTRAL) * gain);
          g = g < 0 ? 0 : g > 255 ? 255 : g;
        }
      }
      out[at * 3] = g;
      out[at * 3 + 1] = edge;
      out[at * 3 + 2] = cover;
    }
  }
  return png;
}

export function writePlate(png, file) {
  return new Promise((resolve, reject) => {
    png
      .pack()
      .pipe(fs.createWriteStream(file))
      .on('finish', resolve)
      .on('error', reject);
  });
}
