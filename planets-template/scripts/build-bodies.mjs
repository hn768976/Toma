#!/usr/bin/env node
// Build the processed surface maps for every body:
//   public/bodies/<id>/{color.webp, normal.webp, meta.json} (+ rings.png)
//
// 1. Download each public-domain global mosaic / elevation model once into
//    .cache/raw (never bundled).
// 2. Resample to 8192 x 4096 equirectangular (left edge = -180 deg), fill
//    data holes, fix the seam and the poles.
// 3. Normal map from the elevation model where one exists, otherwise from a
//    gentle high-pass of the colour map's luminance (or the procedural
//    generator's height field).
// 4. Write color.webp, normal.webp and meta.json (axial tilt, atmosphere,
//    rings, source credits).
//
// Usage: node scripts/build-bodies.mjs [--only=mars,saturn] [--size=8192]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resampleTiff } from "./lib/tiff.mjs";
import {
  pushPullFill, fixPoles, blendSeam, normalsFromHeight, highPassHeight, gaussian,
  percentile, writeWebp, writePng, readImage,
} from "./lib/img.mjs";
import * as proc from "./lib/procedural.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, ".cache", "raw");
const OUT = path.join(ROOT, "public", "bodies");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const W = Number(args.size ?? 8192), H = W / 2;
const ONLY = args.only ? args.only.split(",") : null;
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

// USGS Astrogeology map archive (planetarymaps.usgs.gov/mosaic/ is served
// from this public S3 bucket; both URLs give the same files).
const USGS = "https://asc-pds-services.s3.amazonaws.com/mosaic/";
const USGS_WEB = "https://planetarymaps.usgs.gov/mosaic/";
const NASA3D = "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures/";

const src = (file, base = USGS) => ({ file: decodeURIComponent(file.split("/").pop()), url: base + file });

// --------------------------------------------------------------- bodies
// Physical data: NASA planetary fact sheets / IAU WGCCRE 2015.
// obliquityDeg > 90 means retrograde rotation (Venus, Uranus, Pluto).
export const BODIES = {
  mercury: {
    name: "Mercury", kind: "planet", radiusKm: 2439.7, flattening: 0, obliquityDeg: 0.034,
    rotationPeriodH: 1407.6,
    color: { ...src("Mercury_MESSENGER_mosaic_global_250m_2013.tif"), mode: "gray", tint: [1.0, 0.94, 0.86], median: 0.42 },
    dem: { ...src("Mercury_Messenger_USGS_DEM_Global_665m_v2.tif"), exaggeration: 5 },
    atmosphere: null,
    surface: { wrap: 0.04, normalStrength: 1.0 },
    credits: [
      ["Colour (panchromatic) mosaic", "Mercury MESSENGER MDIS global mosaic 250 m (2013). NASA / Johns Hopkins University APL / Carnegie Institution of Washington; USGS Astrogeology Science Center.", "Mercury_MESSENGER_mosaic_global_250m_2013.tif"],
      ["Elevation model", "Mercury MESSENGER global DEM 665 m v2. NASA / JHUAPL / Carnegie Institution of Washington; USGS Astrogeology Science Center.", "Mercury_Messenger_USGS_DEM_Global_665m_v2.tif"],
    ],
    notes: "Panchromatic mosaic tinted to Mercury's neutral grey-brown.",
  },
  venus: {
    name: "Venus", kind: "planet", radiusKm: 6051.8, flattening: 0, obliquityDeg: 177.36,
    rotationPeriodH: -5832.5,
    procedural: "venus",
    atmosphere: { color: [1.0, 0.93, 0.78], strength: 0.7, thickness: 0.045, crescent: 1.4 },
    surface: { wrap: 0.35, normalStrength: 0.15 },
    credits: [],
    notes: "Procedural cloud-top map (visible-light Venus is a soft, nearly featureless cloud deck; the public-domain global maps are Magellan radar of the surface, which is never visible).",
  },
  mars: {
    name: "Mars", kind: "planet", radiusKm: 3389.5, flattening: 0.00589, obliquityDeg: 25.19,
    rotationPeriodH: 24.6229,
    color: { ...src("Mars_Viking_ClrMosaic_global_925m.tif"), mode: "rgb", whitenCaps: true },
    dem: { ...src("Mars_MGS_MOLA_DEM_mosaic_global_463m.tif"), exaggeration: 3.5 },
    atmosphere: { color: [1.0, 0.62, 0.48], strength: 0.08, thickness: 0.012, crescent: 0.8 },
    surface: { wrap: 0.06, normalStrength: 1.0 },
    credits: [
      ["Colour mosaic", "Mars Viking MDIM2.1 colorized global mosaic 925 m. NASA / JPL / USGS Astrogeology Science Center.", "Mars_Viking_ClrMosaic_global_925m.tif"],
      ["Elevation model", "Mars MGS MOLA DEM 463 m. NASA / GSFC MOLA Science Team; USGS Astrogeology Science Center.", "Mars_MGS_MOLA_DEM_mosaic_global_463m.tif"],
    ],
  },
  jupiter: {
    name: "Jupiter", kind: "planet", radiusKm: 71492, flattening: 0.06487, obliquityDeg: 3.13,
    rotationPeriodH: 9.925,
    jupiterBase: src("Jupiter/Jupiter.tif", NASA3D),
    atmosphere: { color: [0.95, 0.88, 0.76], strength: 0.18, thickness: 0.03, crescent: 0.9 },
    surface: { wrap: 0.22, normalStrength: 0.35 },
    credits: [
      ["Global colour map (large-scale structure)", "NASA 3D Resources, \"Jupiter\" global texture (720 x 360). NASA.", "Jupiter/Jupiter.tif"],
    ],
    notes: "Large-scale structure from the NASA map; fine turbulence, colour grade and polar caps procedural.",
  },
  saturn: {
    name: "Saturn", kind: "planet", radiusKm: 60268, flattening: 0.09796, obliquityDeg: 26.73,
    rotationPeriodH: 10.656,
    procedural: "saturn",
    atmosphere: { color: [0.98, 0.90, 0.72], strength: 0.15, thickness: 0.03, crescent: 0.9 },
    surface: { wrap: 0.22, normalStrength: 0.03 },
    rings: "saturn",
    credits: [],
    notes: "Procedural bands from a latitude profile matched to Cassini true-colour images; rings from published ring radii.",
  },
  uranus: {
    name: "Uranus", kind: "planet", radiusKm: 25559, flattening: 0.02293, obliquityDeg: 97.77,
    rotationPeriodH: -17.24,
    procedural: "uranus",
    atmosphere: { color: [0.72, 0.93, 0.96], strength: 0.4, thickness: 0.035, crescent: 1.2 },
    surface: { wrap: 0.35, normalStrength: 0.0, limbDarkening: 0.55 },
    rings: "uranus",
    credits: [],
    notes: "Procedural (no public-domain global map of Uranus exists).",
  },
  neptune: {
    name: "Neptune", kind: "planet", radiusKm: 24764, flattening: 0.01708, obliquityDeg: 28.32,
    rotationPeriodH: 16.11,
    procedural: "neptune",
    atmosphere: { color: [0.45, 0.62, 1.0], strength: 0.65, thickness: 0.04, crescent: 1.2 },
    surface: { wrap: 0.3, normalStrength: 0.1, limbDarkening: 0.45 },
    credits: [],
    notes: "Procedural (no public-domain global map of Neptune exists); features after Voyager 2 images.",
  },
  pluto: {
    name: "Pluto", kind: "dwarf", radiusKm: 1188.3, flattening: 0, obliquityDeg: 122.53,
    rotationPeriodH: -153.29,
    color: { ...src("Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif"), mode: "pluto", median: 0.55 },
    dem: { ...src("Pluto_NewHorizons_Global_DEM_300m_Jul2017_16bit.tif"), exaggeration: 4 },
    atmosphere: { color: [0.55, 0.72, 1.0], strength: 0.15, thickness: 0.018, crescent: 1.0 },
    surface: { wrap: 0.05, normalStrength: 1.0 },
    credits: [
      ["Panchromatic mosaic", "Pluto New Horizons LORRI/MVIC global mosaic 300 m (Jul 2017). NASA / Johns Hopkins University APL / Southwest Research Institute; USGS Astrogeology Science Center.", "Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif"],
      ["Elevation model", "Pluto New Horizons global DEM 300 m (Jul 2017). NASA / JHUAPL / SwRI; USGS Astrogeology Science Center.", "Pluto_NewHorizons_Global_DEM_300m_Jul2017_16bit.tif"],
    ],
    notes: "Colourised with a ramp matched to New Horizons colour images; the unimaged south (polar night in 2015) is filled procedurally.",
  },
  ceres: {
    name: "Ceres", kind: "dwarf", radiusKm: 469.7, flattening: 0.075, obliquityDeg: 4.0,
    rotationPeriodH: 9.074,
    color: { ...src("Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif"), mode: "gray", tint: [1.0, 0.97, 0.93], median: 0.40 },
    dem: { ...src("Ceres_Dawn_FC_HAMO_DTM_DLR_Global_60ppd_Oct2016.tif"), exaggeration: 2.5 },
    atmosphere: null,
    surface: { wrap: 0.04, normalStrength: 1.0 },
    credits: [
      ["Panchromatic mosaic", "Ceres Dawn FC global mosaic 20 ppd (Oct 2015). NASA / JPL-Caltech / UCLA / MPS / DLR / IDA; USGS Astrogeology Science Center.", "Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif"],
      ["Elevation model", "Ceres Dawn FC HAMO DTM 60 ppd (Oct 2016). NASA / JPL-Caltech / UCLA / MPS / DLR / IDA; USGS Astrogeology Science Center.", "Ceres_Dawn_FC_HAMO_DTM_DLR_Global_60ppd_Oct2016.tif"],
    ],
  },
};

// --------------------------------------------------------------- download
async function download(s) {
  fs.mkdirSync(RAW, { recursive: true });
  const dest = path.join(RAW, s.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  log(`downloading ${s.url}`);
  const res = await fetch(s.url);
  if (!res.ok) throw new Error(`${s.url}: HTTP ${res.status}`);
  const part = dest + ".part";
  const ws = fs.createWriteStream(part);
  for await (const chunk of res.body) if (!ws.write(chunk)) await new Promise((r) => ws.once("drain", r));
  await new Promise((r) => ws.end(r));
  fs.renameSync(part, dest);
  return dest;
}

// --------------------------------------------------------------- helpers
function finishChannel(ch) {
  return blendSeam(fixPoles(ch, W, H, 8, 1.4), W, H, 24);
}

function normalizeGray(g, cover, median) {
  const med = percentile(g, 0.5, cover);
  const k = median / Math.max(1e-6, med);
  const out = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) out[i] = g[i] * k;
  return out;
}

// Percentile stretch (1% -> 0.03, 99.5% -> 1.0) for Pluto's high-contrast
// albedo range, so Sputnik Planitia reads near-white and Cthulhu near-black.
function stretchGray(g, cover) {
  const lo = percentile(g, 0.01, cover), hi = percentile(g, 0.995, cover);
  return g.map((v) => 0.03 + 0.97 * Math.max(0, (v - lo) / (hi - lo)));
}

// The Viking colour mosaic renders the polar ice slightly pink; pull bright
// high-latitude pixels toward neutral white.
function whitenCaps(chs) {
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    const w = Math.min(1, Math.max(0, (Math.abs(lat) - 55) / 15));
    if (w <= 0) continue;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const l = 0.3 * chs[0][i] + 0.55 * chs[1][i] + 0.15 * chs[2][i];
      const k = w * Math.min(1, Math.max(0, (l - 0.55) / 0.2)) * 0.75;
      const target = Math.min(1, l * 1.08);
      for (let c = 0; c < 3; c++) chs[c][i] = chs[c][i] + (target - chs[c][i]) * k;
    }
  }
}

function erode(mask, r) {
  const blurred = gaussian(mask, W, H, r);
  return blurred.map((v) => (v > 0.999 ? 1 : 0));
}

async function colorFromMosaic(b) {
  const file = await download(b.color);
  log(`${b.id}: resampling colour ${b.color.file}`);
  const r = await resampleTiff(file, W, H, { log });
  let cover = r.cover;
  // Some mosaics store missing data as near-black instead of nodata.
  if (b.color.mode !== "rgb") {
    cover = cover.map((c, i) => (r.channels[0][i] < 1.5 ? 0 : c));
  }
  // Treat partial coverage at hole edges as missing, and erode the mask a
  // little, so the dark fringe along a data edge never survives.
  const hard = erode(cover.map((c) => (c > 0.98 ? 1 : 0)), Math.max(1, Math.round(W / 2048)));
  if (b.color.mode === "rgb") {
    const chs = r.channels.map((ch) => finishChannel(pushPullFill(ch.map((v) => v / 255), hard, W, H)));
    if (b.color.whitenCaps) whitenCaps(chs);
    return { chs, cover: hard };
  }
  let g = r.channels[0].map((v) => v / 255);
  g = pushPullFill(g, hard, W, H);
  g = b.color.mode === "pluto" ? stretchGray(g, hard) : normalizeGray(g, hard, b.color.median);
  if (b.color.mode === "pluto") {
    // Low-detail mask: local high-frequency energy of the mosaic, smoothed;
    // low energy = the far side imaged only at low resolution.
    const hf = new Float32Array(g.length);
    const lowpass = gaussian(g, W, H, W / 4096);
    for (let i = 0; i < hf.length; i++) hf[i] = Math.abs(g[i] - lowpass[i]);
    const energy = gaussian(hf, W, H, W / 256);
    const eHi = percentile(energy, 0.7, hard);
    const lowDetail = energy.map((e) => Math.max(0, Math.min(1, 1 - e / (0.6 * eHi))));
    const res = proc.plutoColorize(g, gaussian(hard, W, H, W / 1024), W, H, gaussian(lowDetail, W, H, W / 512));
    return { chs: res.chs.map(finishChannel), cover: hard, lum: res.height };
  }
  g = finishChannel(g);
  const t = b.color.tint;
  return { chs: [0, 1, 2].map((c) => g.map((v) => v * t[c])), cover: hard, lum: g };
}

async function heightFromDem(b) {
  const file = await download(b.dem);
  log(`${b.id}: resampling elevation ${b.dem.file}`);
  const r = await resampleTiff(file, W, H, { log });
  const cover = erode(r.cover.map((c) => (c > 0.98 ? 1 : 0)), Math.max(1, Math.round(W / 2048)));
  let h = pushPullFill(r.channels[0], cover, W, H);
  h = blendSeam(fixPoles(h, W, H, 4, 1.0), W, H, 16);
  return { h, cover };
}

function lumOf(chs) {
  const l = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) l[i] = 0.3 * chs[0][i] + 0.55 * chs[1][i] + 0.15 * chs[2][i];
  return l;
}

// Normal map from luminance high-pass (bodies without a DEM). strength is
// the slope per unit of luminance detail.
// Slopes are expressed per 1/8192 of the circumference so the result does
// not depend on the output size.
function normalsFromLum(lum, strength, sigmaPx = 6) {
  const hp = highPassHeight(lum, W, H, (sigmaPx * W) / 8192);
  const mpp = 8192 / W;
  return normalsFromHeight(hp, W, H, mpp, mpp, strength, 6);
}

// --------------------------------------------------------------- build
async function buildBody(id) {
  const b = { id, ...BODIES[id] };
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  let color, normal, extraMeta = {};

  if (b.procedural) {
    log(`${id}: generating procedural map`);
    const p = proc[b.procedural](W, H);
    color = p.chs;
    const hs = b.surface.normalStrength > 0 ? gaussian(p.height, W, H, 1.0) : p.height;
    normal = normalsFromHeight(hs, W, H, 8192 / W, 8192 / W, 60 * b.surface.normalStrength, 4);
  } else if (b.jupiterBase) {
    const file = await download(b.jupiterBase);
    const base = await readImage(file);
    log(`${id}: synthesising detail on the NASA base map (${base.W}x${base.H})`);
    const p = proc.jupiter(W, H, base);
    extraMeta.greatRedSpot = p.grs;
    color = p.chs.map((ch) => blendSeam(fixPoles(ch, W, H, 3, 1.0), W, H, 16));
    normal = normalsFromLum(lumOf(color), 30, 5);
  } else {
    const c = await colorFromMosaic(b);
    color = c.chs;
    const lum = c.lum ?? lumOf(color);
    if (b.dem) {
      const { h, cover } = await heightFromDem(b);
      const R = b.radiusKm * 1000;
      const mpp = (2 * Math.PI * R) / W;
      let n = normalsFromHeight(h, W, H, mpp, mpp, b.dem.exaggeration, 8);
      // Where the DEM had no data (Pluto's far side), use the colour map.
      let missing = 0;
      for (let i = 0; i < W * H; i++) missing += 1 - cover[i];
      if (missing / (W * H) > 0.01) {
        log(`${id}: DEM covers ${(100 * (1 - missing / (W * H))).toFixed(1)}%, blending luminance normals`);
        const nl = normalsFromLum(lum, 120, 4);
        const wgt = gaussian(cover, W, H, W / 512);
        n = n.map((ch, k) => ch.map((v, i) => v * wgt[i] + nl[k][i] * (1 - wgt[i])));
      }
      normal = n;
    } else {
      normal = normalsFromLum(lum, 120, 4);
    }
  }

  log(`${id}: encoding`);
  await writeWebp(color, W, H, path.join(dir, "color.webp"), { quality: 93 });
  const enc = normal.map((ch, k) => ch.map((v) => (k === 2 ? v : v * 0.5 + 0.5)));
  // Re-normalise and pack into [0,1]: x,y in [-1,1] -> [0,1]; z in [0,1].
  await writeWebp(enc, W, H, path.join(dir, "normal.webp"), { quality: 95 });

  let rings = null;
  if (b.rings) {
    const N = 4096;
    const r = b.rings === "saturn" ? proc.saturnRings(N) : proc.uranusRings(N);
    const rows = 4;
    const chs = r.rgba.map((ch) => {
      const o = new Float32Array(N * rows);
      for (let y = 0; y < rows; y++) o.set(ch, y * N);
      return o;
    });
    await writePng(chs, N, rows, path.join(dir, "rings.png"));
    rings = { texture: "rings.png", inner: r.inner, outer: r.outer };
  }

  const meta = {
    id, name: b.name, kind: b.kind,
    radiusKm: b.radiusKm, flattening: b.flattening,
    obliquityDeg: b.obliquityDeg, retrograde: b.obliquityDeg > 90,
    rotationPeriodH: b.rotationPeriodH,
    maps: { color: "color.webp", normal: "normal.webp", width: W, height: H, longitudeLeftEdgeDeg: -180 },
    surface: { saturation: 1.1, ...b.surface },
    atmosphere: b.atmosphere,
    rings,
    procedural: Boolean(b.procedural) || Boolean(b.jupiterBase) || b.color?.mode === "pluto",
    notes: b.notes ?? "",
    ...extraMeta,
    credits: b.credits.map(([what, credit, file]) => ({
      what, credit,
      url: file.includes("/") ? NASA3D + file : USGS_WEB + file,
      mirror: file.includes("/") ? undefined : USGS + file,
      license: "Public domain (U.S. Government work: NASA / USGS)",
    })),
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  log(`${id}: done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

const ids = ONLY ?? Object.keys(BODIES);
for (const id of ids) {
  if (!BODIES[id]) throw new Error(`unknown body ${id}`);
  await buildBody(id);
}
