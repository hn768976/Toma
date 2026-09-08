/**
 * Bakes one basemap tile per (region, palette) into public/basemaps/.
 *
 * Sources, both public domain:
 *   data/bluemarble-4096x2048.jpg  NASA Blue Marble Next Generation (Visible Earth)
 *   data/ne_10m_*.json             Natural Earth 10m physical + cultural vectors
 *
 * The tile is baked in exactly the projection and window the renderer uses, so
 * the component only has to place it — see src/lib/geo.ts. Run after adding a
 * region:  npm run bake
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const DATA = path.join(ROOT, "data");
const OUT = path.join(ROOT, "public", "basemaps");

const { REGIONS } = await import(path.join(ROOT, "src/data/regions.ts"));
const geo = await import(path.join(ROOT, "src/lib/geo.ts"));

const RENDER_W = 3840;
const RENDER_H = 2160;
/** Cap on the baked tile's width. Above this the file cost stops paying off. */
const MAX_TILE_W = 4096;

const args = process.argv.slice(2);
const argVal = (k) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : undefined;
};
const onlyRegion = argVal("region");
const forcePalette = argVal("palette");
const allPalettes = args.includes("--all-palettes");

// ---------------------------------------------------------------- vector data

const loadRings = (name) => {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));
  const s = raw.scale;
  return raw.rings.map((flat) => {
    const pts = new Array(flat.length / 2);
    let x = 0;
    let y = 0;
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      pts[i / 2] = [x / s, y / s];
    }
    return pts;
  });
};

const LAND = loadRings("ne_10m_land");
const COAST = loadRings("ne_10m_coastline");
const BORDERS = loadRings("ne_10m_borders");
const LAKES = loadRings("ne_10m_lakes");

// ------------------------------------------------------------------- svg bits

/** Rings -> SVG path data in (lon, -lat) space, repeated across the antimeridian. */
const ringsToPath = (rings, win, close) => {
  const offsets = [0];
  if (win.lonMin < -180) offsets.push(-360);
  if (win.lonMax > 180) offsets.push(360);
  const pad = 2;
  const out = [];
  for (const off of offsets) {
    for (const ring of rings) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of ring) {
        const x = p[0] + off;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
      if (
        maxX < win.lonMin - pad ||
        minX > win.lonMax + pad ||
        maxY < win.latMin - pad ||
        minY > win.latMax + pad
      ) {
        continue;
      }
      let d = "";
      for (let i = 0; i < ring.length; i++) {
        d += `${i === 0 ? "M" : "L"}${(ring[i][0] + off).toFixed(3)} ${(-ring[i][1]).toFixed(3)}`;
      }
      out.push(close ? `${d}Z` : d);
    }
  }
  return out.join("");
};

const svgWrap = (win, w, h, body) => {
  const vb = `${win.lonMin} ${-win.latMax} ${win.lonMax - win.lonMin} ${win.latMax - win.latMin}`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${body}</svg>`,
  );
};

// ------------------------------------------------------------------ resampling

/** Bilinear sample of the equirectangular source, wrapping in lon, clamping in lat. */
const resampleWindow = (src, srcW, srcH, win, w, h) => {
  const out = Buffer.allocUnsafe(w * h * 3);
  const lonSpan = win.lonMax - win.lonMin;
  const latSpan = win.latMax - win.latMin;
  for (let j = 0; j < h; j++) {
    const lat = win.latMax - ((j + 0.5) / h) * latSpan;
    let sy = ((90 - lat) / 180) * srcH - 0.5;
    if (sy < 0) sy = 0;
    if (sy > srcH - 1.001) sy = srcH - 1.001;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    const y1 = Math.min(srcH - 1, y0 + 1);
    for (let i = 0; i < w; i++) {
      const lon = win.lonMin + ((i + 0.5) / w) * lonSpan;
      let sx = ((((lon + 180) % 360) + 360) % 360) / 360 * srcW - 0.5;
      if (sx < 0) sx += srcW;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const x1 = (x0 + 1) % srcW;
      const a = (y0 * srcW + x0) * 3;
      const b = (y0 * srcW + x1) * 3;
      const c = (y1 * srcW + x0) * 3;
      const d = (y1 * srcW + x1) * 3;
      const o = (j * w + i) * 3;
      for (let k = 0; k < 3; k++) {
        const top = src[a + k] * (1 - fx) + src[b + k] * fx;
        const bot = src[c + k] * (1 - fx) + src[d + k] * fx;
        out[o + k] = (top * (1 - fy) + bot * fy) | 0;
      }
    }
  }
  return out;
};

// --------------------------------------------------------------------- shading

/** Separable box blur of a single-channel buffer, used to build a high-pass. */
const boxBlur = (buf, w, h, r) => {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) acc += buf[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * inv;
      acc += buf[row + Math.min(w - 1, x + r + 1)] - buf[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * inv;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
};

const hash2 = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Value noise, smoothed, used for water mottle and land micro-texture. */
const valueNoise = (x, y, freq, seed) => {
  const fx = x * freq;
  const fy = y * freq;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
};

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const mix = (a, b, t) => a + (b - a) * t;

const PALETTES = {
  warm: {
    waterDeep: [2, 9, 18],
    waterShelf: [10, 36, 60],
    landGain: 1.14,
    landSat: 1.32,
    landTint: [1.09, 1.0, 0.87],
    highlightKnee: 0.62,
    reliefMix: 0.0,
  },
  cool: {
    waterDeep: [5, 16, 30],
    waterShelf: [12, 39, 67],
    // Shaded-relief look: land is a pale blue-grey ramp driven by luminance and
    // a high-pass of it, rather than the photographic colour.
    landLow: [48, 69, 93],
    landHigh: [198, 212, 226],
    reliefMix: 1.0,
  },
};

// ------------------------------------------------------------------------ bake

const bakeOne = async (region, palette, srcRaw, srcW, srcH) => {
  const g = geo.mapGeometry(region, RENDER_W, RENDER_H);
  const win = g.window;
  const scale = Math.min(1, MAX_TILE_W / g.planeW);
  const w = Math.round(g.planeW * scale);
  const h = Math.round(g.planeH * scale);
  const P = PALETTES[palette];

  const sat = resampleWindow(srcRaw, srcW, srcH, win, w, h);

  // land mask (land minus lakes), softened by a hair so coasts are not aliased
  const maskSvg = svgWrap(
    win,
    w,
    h,
    `<rect x="-400" y="-200" width="800" height="400" fill="#000"/>` +
      `<path d="${ringsToPath(LAND, win, true)}" fill="#fff" fill-rule="evenodd"/>` +
      `<path d="${ringsToPath(LAKES, win, true)}" fill="#000" fill-rule="evenodd"/>`,
  );
  const mask = await sharp(maskSvg, { limitInputPixels: false })
    .greyscale()
    .blur(0.6)
    .raw()
    .toBuffer();

  // luminance + high-pass, for the shaded-relief treatment
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * sat[i * 3] + 0.587 * sat[i * 3 + 1] + 0.114 * sat[i * 3 + 2];
  }
  const lumBlur = P.reliefMix > 0 ? boxBlur(lum, w, h, Math.max(2, Math.round(w / 900))) : null;

  const px = Buffer.allocUnsafe(w * h * 3);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      const o = idx * 3;
      const m = mask[idx] / 255;

      // --- water: depth ramp from the source's own bathymetry, plus mottle
      const depth = Math.min(1, Math.max(0, (lum[idx] - 6) / 78));
      const mottle = (valueNoise(i, j, 0.006, 11) - 0.5) * 0.18 +
        (valueNoise(i, j, 0.03, 23) - 0.5) * 0.07;
      const wt = Math.min(1, Math.max(0, depth + mottle));
      const wr = mix(P.waterDeep[0], P.waterShelf[0], wt);
      const wg = mix(P.waterDeep[1], P.waterShelf[1], wt);
      const wb = mix(P.waterDeep[2], P.waterShelf[2], wt);

      // --- land
      let lr;
      let lg;
      let lb;
      if (P.reliefMix > 0) {
        const relief = (lum[idx] - lumBlur[idx]) / 255;
        // soft knee keeps deserts and snow from clipping to flat white
        const ln = lum[idx] / 255;
        const kneed = ln > 0.50 ? 0.5 + (ln - 0.5) * 0.34 : ln;
        let t = 0.14 + kneed * 0.86 + relief * 1.9;
        t += (valueNoise(i, j, 0.05, 37) - 0.5) * 0.06;
        t = Math.min(1, Math.max(0, t));
        lr = mix(P.landLow[0], P.landHigh[0], t);
        lg = mix(P.landLow[1], P.landHigh[1], t);
        lb = mix(P.landLow[2], P.landHigh[2], t);
      } else {
        const l = lum[idx];
        // soft knee on the highlights so winter snow does not blow out
        const knee = l > 255 * P.highlightKnee
          ? 255 * P.highlightKnee + (l - 255 * P.highlightKnee) * 0.5
          : l;
        const k = l > 0 ? knee / l : 1;
        const micro = 1 + (valueNoise(i, j, 0.09, 53) - 0.5) * 0.1;
        lr = clamp255((l + (sat[o] - l) * P.landSat) * k * P.landGain * P.landTint[0] * micro);
        lg = clamp255((l + (sat[o + 1] - l) * P.landSat) * k * P.landGain * P.landTint[1] * micro);
        lb = clamp255((l + (sat[o + 2] - l) * P.landSat) * k * P.landGain * P.landTint[2] * micro);
      }

      px[o] = clamp255(mix(wr, lr, m));
      px[o + 1] = clamp255(mix(wg, lg, m));
      px[o + 2] = clamp255(mix(wb, lb, m));
    }
  }

  // vector detail on top: coastline, admin boundaries, lake edges
  const degPerPx = (win.lonMax - win.lonMin) / w;
  const sw = (n) => (n * degPerPx).toFixed(4);
  const lineColor = palette === "cool" ? "#0b1a2b" : "#04121f";
  const coastGlow = palette === "cool" ? "#9fc6e0" : "#6fa8c8";
  const linesSvg = svgWrap(
    win,
    w,
    h,
    `<g fill="none" stroke-linejoin="round" stroke-linecap="round">` +
      `<path d="${ringsToPath(COAST, win, false)}" stroke="${coastGlow}" stroke-opacity="${palette === "cool" ? 0.26 : 0.16}" stroke-width="${sw(2.4)}"/>` +
      `<path d="${ringsToPath(COAST, win, false)}" stroke="${lineColor}" stroke-opacity="0.60" stroke-width="${sw(1.1)}"/>` +
      `<path d="${ringsToPath(LAKES, win, true)}" stroke="${lineColor}" stroke-opacity="0.45" stroke-width="${sw(1.0)}"/>` +
      `<path d="${ringsToPath(BORDERS, win, false)}" stroke="${lineColor}" stroke-opacity="${palette === "cool" ? 0.5 : 0.34}" stroke-width="${sw(1.3)}"/>` +
      `</g>`,
  );

  const file = path.join(OUT, `${region.id}-${palette}.jpg`);
  await sharp(px, { raw: { width: w, height: h, channels: 3 } })
    .composite([{ input: linesSvg, blend: "over", limitInputPixels: false }])
    .sharpen({ sigma: 0.7, m1: 0.4, m2: 0.9 })
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(file);

  const kb = (fs.statSync(file).size / 1024) | 0;
  const v = g.visible;
  console.log(
    `${region.id}-${palette}`.padEnd(30) +
      `${w}x${h}  ${String(kb).padStart(5)} KB   ` +
      `plane lon ${win.lonMin.toFixed(1)}..${win.lonMax.toFixed(1)} lat ${win.latMin.toFixed(1)}..${win.latMax.toFixed(1)}` +
      `   visible lon ${v.lonMin.toFixed(1)}..${v.lonMax.toFixed(1)} lat ${v.latMin.toFixed(1)}..${v.latMax.toFixed(1)}`,
  );
};

/** 512px tiling grain plate — cheaper and steadier than per-frame feTurbulence. */
const bakeGrain = async () => {
  const n = 512;
  const buf = Buffer.allocUnsafe(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const o = (j * n + i) * 4;
      const v = clamp255(128 + (hash2(i, j, 7) - 0.5) * 255);
      buf[o] = v;
      buf[o + 1] = v;
      buf[o + 2] = v;
      buf[o + 3] = 255;
    }
  }
  const file = path.join(ROOT, "public", "grain.png");
  await sharp(buf, { raw: { width: n, height: n, channels: 4 } }).png().toFile(file);
  console.log(`grain.png`.padEnd(30) + `${n}x${n}`);
};

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srcFile = path.join(DATA, "bluemarble-4096x2048.jpg");
  const src = sharp(srcFile);
  const meta = await src.metadata();
  const srcRaw = await src.removeAlpha().raw().toBuffer();
  console.log(`source ${path.basename(srcFile)} ${meta.width}x${meta.height}\n`);

  for (const region of REGIONS) {
    if (onlyRegion && region.id !== onlyRegion) continue;
    const palettes = forcePalette
      ? [forcePalette]
      : allPalettes
        ? ["warm", "cool"]
        : [region.palette];
    for (const p of palettes) {
      await bakeOne(region, p, srcRaw, meta.width, meta.height);
    }
  }
  await bakeGrain();
};

await main();
