/**
 * Bakes every country in src/countries.ts into render-ready assets.
 *
 *   npm run build:assets            # all countries
 *   npm run build:assets -- BRA POL # just these
 *
 * Everything the compositions read at render time is produced here: projected
 * SVG path strings in composition pixels, resolved label positions, and the
 * pre-warped relief and satellite rasters. Nothing is projected, fetched or
 * measured while rendering.
 */

import {mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {geoBounds, geoPath} from 'd3-geo';
import type {GeoProjection} from 'd3-geo';

import {COUNTRIES, type CountryConfig} from '../src/countries';
import {
  buildProjection,
  normLon,
  type BakedFraming,
} from '../src/geo/projection';
import {COMP_HEIGHT, COMP_WIDTH, MARKER, TYPE, estimateTextWidth} from '../src/layout';
import {RELIEF_VARIANTS, STYLES} from '../src/styles';
import {
  collectRings,
  computeFraming,
  explodePolygons,
  framingParts,
  labelAnchor,
  pointInRings,
  ringsBBox,
  type AnyGeometry,
  type Feature,
} from './lib/geo-utils';
import {OFFICIAL_RATIOS, prepareFlag} from './lib/flags';
import {
  hexToRgb,
  sourceDensity,
  warpRelief,
  type GrayRaster,
} from './lib/raster';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
const DATA_OUT = path.join(ROOT, 'src', 'data');
const RELIEF_OUT = path.join(ROOT, 'public', 'relief');
const SAT_OUT = path.join(ROOT, 'public', 'satellite');

const W = COMP_WIDTH;
const H = COMP_HEIGHT;
/** Geometry is clipped a little outside the frame so strokes never end mid-air. */
const CLIP_MARGIN = 48;

const EARTH_CIRCUMFERENCE_M = 40_075_017;

// ── sources ────────────────────────────────────────────────────────────────

const readGeoJSON = (name: string): {features: Feature[]} => {
  const p = path.join(CACHE, `${name}.geojson`);
  if (!existsSync(p)) {
    throw new Error(`Missing ${p}. Run: node scripts/fetch-data.mjs`);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
};

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets: CountryConfig[] = only.length
  ? COUNTRIES.filter((c) => only.includes(c.code))
  : COUNTRIES;
if (only.length && targets.length !== only.length) {
  throw new Error(`Unknown code(s): ${only.filter((c) => !COUNTRIES.some((x) => x.code === c))}`);
}

console.log(`Building ${targets.length} countries.\n`);

const countries = readGeoJSON('ne_50m_admin_0_countries');
const land = readGeoJSON('ne_50m_land');
const lakes = readGeoJSON('ne_50m_lakes');
const coastline = readGeoJSON('ne_50m_coastline');
const borders = readGeoJSON('ne_50m_admin_0_boundary_lines_land');
const marine = readGeoJSON('ne_50m_geography_marine_polys');
// 1:10m for cities — the 50m set only carries ~1250 places worldwide, far too
// few to give every country a credible 10-14 city list.
const places = readGeoJSON('ne_10m_populated_places');

const prop = (f: Feature, key: string): string => String(f.properties[key] ?? '');
const num = (f: Feature, key: string): number => Number(f.properties[key] ?? NaN);

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// ── raster sources ─────────────────────────────────────────────────────────

const GRAY_TIF = path.join(CACHE, 'gray', 'GRAY_HR_SR_W.tif');
const satelliteSource = JSON.parse(
  readFileSync(path.join(CACHE, 'satellite-source.json'), 'utf8')
) as {satellite: 'bluemarble' | 'naturalearth'};
const SAT_SRC =
  satelliteSource.satellite === 'bluemarble'
    ? path.join(CACHE, 'bluemarble.jpg')
    : path.join(CACHE, 'ne2', 'NE2_HR_LC_SR_W.tif');

let reliefRaster: GrayRaster | null = null;
const getRelief = async (): Promise<GrayRaster> => {
  if (reliefRaster) return reliefRaster;
  process.stdout.write('  loading relief raster ... ');
  const {data, info} = await sharp(GRAY_TIF, {limitInputPixels: false})
    .greyscale()
    .raw()
    .toBuffer({resolveWithObject: true});
  reliefRaster = {data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height};
  console.log(`${info.width}x${info.height}`);
  return reliefRaster;
};

let satMeta: {width: number; height: number} | null = null;
const getSatMeta = async () => {
  if (satMeta) return satMeta;
  const m = await sharp(SAT_SRC, {limitInputPixels: false}).metadata();
  satMeta = {width: m.width!, height: m.height!};
  return satMeta;
};

// ── shared geometry prep ───────────────────────────────────────────────────

/**
 * Natural Earth records ISO_A2 as "-99" for a handful of countries (France and
 * Norway among them), so the flag lookup carries its own map rather than
 * trusting that field.
 */
const ISO2: Record<string, string> = {
  USA: 'us', CHN: 'cn', IND: 'in', RUS: 'ru', JPN: 'jp', DEU: 'de', GBR: 'gb',
  FRA: 'fr', BRA: 'br', CAN: 'ca', IDN: 'id', MEX: 'mx', TUR: 'tr', SAU: 'sa',
  KOR: 'kr', AUS: 'au', ITA: 'it', ESP: 'es', ZAF: 'za', POL: 'pl', NLD: 'nl',
  ARE: 'ae', SGP: 'sg', VNM: 'vn', NGA: 'ng', EGY: 'eg', ARG: 'ar', SWE: 'se',
  THA: 'th', PHL: 'ph', CHE: 'ch', NOR: 'no', CHL: 'cl',
};

const subjectGeometry = (code: string): {geometry: AnyGeometry; feature: Feature} => {
  const feats = countries.features.filter((f) => prop(f, 'ADM0_A3') === code);
  if (!feats.length) throw new Error(`No Natural Earth feature with ADM0_A3=${code}`);
  const polys = feats.flatMap((f) => explodePolygons(f.geometry));
  return {geometry: {type: 'MultiPolygon', coordinates: polys}, feature: feats[0]};
};

type CityLabelSide = 'r' | 'l' | 't' | 'b' | 'tr' | 'br' | 'tl' | 'bl';

interface PlacedLabel {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Boxes are tested with a little padding: the offline width estimate is close
 *  but not exact, and a near-miss reads on screen as a collision. */
const LABEL_PAD = 6;
const overlaps = (a: PlacedLabel, b: PlacedLabel) =>
  a.x - LABEL_PAD < b.x + b.w &&
  a.x + a.w + LABEL_PAD > b.x &&
  a.y - LABEL_PAD < b.y + b.h &&
  a.y + a.h + LABEL_PAD > b.y;

// ── per-country build ──────────────────────────────────────────────────────

interface Report {
  code: string;
  name: string;
  projection: string;
  partsKept: string;
  cities: number;
  droppedCities: string[];
  reliefPx: string;
  reliefUpscale: number;
  v3: null | {
    zoomFactor: number;
    endSpanKm: number;
    endMetresPerPixel: number;
    sourceMetresPerPixel: number;
    upscale: number;
    flagFill: boolean;
    flagRatioOk: boolean | null;
  };
  warnings: string[];
}

const reports: Report[] = [];

const buildCountry = async (cfg: CountryConfig) => {
  const warnings: string[] = [];
  const t0 = Date.now();
  const {geometry, feature} = subjectGeometry(cfg.code);
  const name = cfg.displayName ?? prop(feature, 'NAME_EN') ?? prop(feature, 'NAME');
  const neIso2 = prop(feature, 'ISO_A2').toLowerCase();
  const iso2 = ISO2[cfg.code] ?? (neIso2 === '-99' ? '' : neIso2);
  process.stdout.write(`${cfg.code} ${name.padEnd(16)}`);

  // 1. Which parts drive the framing, and the framing itself.
  const parts = framingParts(geometry, cfg.framing ?? {});
  const framing: BakedFraming = computeFraming(parts.geometry, W, H, cfg.framing ?? {});
  const projection = buildProjection(framing);
  projection.clipExtent([
    [-CLIP_MARGIN, -CLIP_MARGIN],
    [W + CLIP_MARGIN, H + CLIP_MARGIN],
  ]);
  const pathGen = geoPath(projection).digits(1);

  const d = (g: AnyGeometry | Feature[]): string => {
    if (Array.isArray(g)) {
      return g.map((f) => pathGen(f.geometry as never) ?? '').filter(Boolean).join(' ');
    }
    return pathGen(g as never) ?? '';
  };

  // 2. Which features are in frame at all. Bounds are computed under the same
  //    projection, so this is exact rather than a lat/lon guess.
  const inFrame = (f: Feature): boolean => {
    const b = pathGen.bounds(f.geometry as never);
    if (!Number.isFinite(b[0][0])) return false;
    return b[1][0] > -CLIP_MARGIN && b[0][0] < W + CLIP_MARGIN && b[1][1] > -CLIP_MARGIN && b[0][1] < H + CLIP_MARGIN;
  };

  const landInFrame = land.features.filter(inFrame);
  const lakesInFrame = lakes.features.filter(inFrame);
  const coastInFrame = coastline.features.filter(inFrame);
  const bordersInFrame = borders.features.filter(inFrame);

  // 3. Subject geometry, its visible label anchor and bounding box.
  const subjectRings = collectRings(projection, geometry);
  // The framed body, separate from everything that merely gets drawn: distant
  // territories are allowed to fall outside the frame, the mainland is not.
  const fitRingsProjected = collectRings(projection, parts.geometry);
  if (!subjectRings.length) throw new Error(`${cfg.code}: subject projects to nothing`);
  const subjectBBox = ringsBBox(subjectRings);
  const anchor = labelAnchor(subjectRings, W, H) ?? {
    x: subjectBBox.x + subjectBBox.w / 2,
    y: subjectBBox.y + subjectBBox.h / 2,
    clearance: 0,
  };
  const [tox, toy] = cfg.framing?.titleOffset ?? [0, 0];
  const title = {x: anchor.x + tox * W, y: anchor.y + toy * H};
  const bb = subjectBBox;

  // 4. Neighbours: every other country with territory in frame, labelled inside
  //    whatever part of it is actually visible.
  const neighbourFeatures = countries.features.filter(
    (f) => prop(f, 'ADM0_A3') !== cfg.code && inFrame(f)
  );
  const neighbourLabels: {name: string; x: number; y: number}[] = [];
  const placed: PlacedLabel[] = [];
  const neighbourSize = TYPE.neighbour * W;
  for (const f of neighbourFeatures.sort((a, b) => num(b, 'POP_EST') - num(a, 'POP_EST'))) {
    if (neighbourLabels.length >= 12) break;
    const rings = collectRings(projection, f.geometry);
    if (!rings.length) continue;
    const a = labelAnchor(rings, W, H);
    if (!a) continue;
    // NAME is Natural Earth's short display name ("China"); NAME_EN is the long
    // form ("People's Republic of China"), which is wrong for a neighbour label.
    const label = (prop(f, 'NAME') || prop(f, 'NAME_EN')).toUpperCase();
    const tw = estimateTextWidth(label, neighbourSize, {
      caps: true,
      letterSpacing: TYPE.neighbourLetterSpacing,
    });
    // Only label a country if its visible sliver can hold the name, and only if
    // the whole name fits in frame — a half-word at the edge reads as a bug.
    if (a.clearance * 2 < tw * 0.55 || a.clearance < neighbourSize * 1.15) continue;
    if (a.x - tw / 2 < 12 || a.x + tw / 2 > W - 12) continue;
    const box = {x: a.x - tw / 2, y: a.y - neighbourSize / 2, w: tw, h: neighbourSize * 1.4};
    if (placed.some((p) => overlaps(p, box))) continue;
    placed.push(box);
    neighbourLabels.push({name: label, x: a.x, y: a.y});
  }

  // 5. Named seas and gulfs.
  const marineLabels: {name: string; x: number; y: number}[] = [];
  const marineSize = TYPE.marine * W;
  for (const f of marine.features.filter(inFrame)) {
    const rings = collectRings(projection, f.geometry);
    if (!rings.length) continue;
    const a = labelAnchor(rings, W, H);
    if (!a) continue;
    const label = prop(f, 'name') || prop(f, 'NAME');
    if (!label) continue;
    const tw = estimateTextWidth(label, marineSize, {letterSpacing: TYPE.marineLetterSpacing});
    if (a.clearance * 2 < tw * 0.5) continue;
    if (a.x - tw / 2 < 12 || a.x + tw / 2 > W - 12) continue;
    const box = {x: a.x - tw / 2, y: a.y - marineSize / 2, w: tw, h: marineSize * 1.4};
    if (placed.some((p) => overlaps(p, box))) continue;
    placed.push(box);
    marineLabels.push({name: label, x: a.x, y: a.y});
  }

  // 6. Cities. Names resolve to Natural Earth coordinates — never typed by hand.
  const SETTLEMENT = /^(populated place|admin-\d|admin-\d region capital|admin-0 capital alt)/i;
  const candidates = places.features.filter(
    (f) =>
      (prop(f, 'ADM0_A3') === cfg.code || prop(f, 'SOV_A3') === cfg.code) &&
      SETTLEMENT.test(prop(f, 'FEATURECLA'))
  );
  const isCapital = (f: Feature) => prop(f, 'FEATURECLA').toLowerCase().includes('admin-0 capital');
  const byName = new Map<string, Feature>();
  for (const f of candidates) {
    for (const key of ['NAME', 'NAMEASCII', 'NAME_EN', 'NAMEALT']) {
      const v = prop(f, key);
      if (v && !byName.has(fold(v))) byName.set(fold(v), f);
    }
  }

  let chosen: Feature[];
  const droppedCities: string[] = [];
  if (cfg.cities?.length) {
    chosen = [];
    for (const wanted of cfg.cities) {
      const f = byName.get(fold(wanted));
      if (f) chosen.push(f);
      else {
        droppedCities.push(wanted);
        warnings.push(`city not in Natural Earth: ${wanted}`);
      }
    }
  } else {
    // Capital first, then by population — but only accept a city that is far
    // enough from the ones already taken, so the list spreads across the country
    // instead of stacking up in one conurbation.
    const ranked = [...candidates].sort((a, b) => {
      const ca = isCapital(a) ? 1 : 0;
      const cb = isCapital(b) ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return num(b, 'POP_MAX') - num(a, 'POP_MAX');
    });
    // Spread relative to the subject, not the frame: a fixed frame fraction
    // thins a small country's list down to two or three cities.
    const minGap = Math.max(W * 0.012, Math.min(W * 0.035, subjectBBox.w * 0.13));
    const taken: [number, number][] = [];
    chosen = [];
    for (const f of ranked) {
      const pt = projection([num(f, 'LONGITUDE'), num(f, 'LATITUDE')]);
      if (!pt) continue;
      if (taken.some(([x, y]) => Math.hypot(x - pt[0], y - pt[1]) < minGap)) continue;
      taken.push([pt[0], pt[1]]);
      chosen.push(f);
      if (chosen.length >= 26) break;
    }
  }
  // The capital always makes the cut — it anchors the location ping.
  const capitalFeature = candidates.find(isCapital);
  if (capitalFeature && !chosen.includes(capitalFeature)) chosen.unshift(capitalFeature);

  const citySize = TYPE.city * W;
  const titleNatural = TYPE.title * W;
  const titleEst = estimateTextWidth(name.toUpperCase(), titleNatural, {
    caps: true,
    letterSpacing: TYPE.titleLetterSpacing,
  });
  // The name is sized to the frame but capped against the country it sits on, so
  // a small subject does not end up with type spilling far out into the sea.
  const titleLimit = Math.min(
    TYPE.titleMaxWidthFrac * W,
    Math.max(subjectBBox.w * 1.15, 0.22 * W)
  );
  const titleW = Math.min(titleEst, titleLimit);
  const titleH = titleNatural * 1.15;

  const cityPlaced: PlacedLabel[] = [];
  const cities: {name: string; x: number; y: number; capital: boolean; side: CityLabelSide}[] = [];
  const edge = W * 0.02;

  /** Place one city's marker and label, routing the label around what is already
   *  down. The capital keeps its marker even if every label slot is taken — the
   *  location ping is anchored to it. */
  const placeCity = (f: Feature): boolean => {
    const pt = projection([num(f, 'LONGITUDE'), num(f, 'LATITUDE')]);
    if (!pt) return false;
    const [x, y] = pt;
    if (x < edge || x > W - edge || y < edge || y > H - edge) return false;
    // NAME is Natural Earth's display label. NAME_EN is a Wikipedia-derived
    // field with occasional bad rows, so it is only a fallback.
    const label = prop(f, 'NAME') || prop(f, 'NAME_EN');
    const capital = isCapital(f);
    const tw = estimateTextWidth(label, citySize);
    const r = (capital ? MARKER.capital : MARKER.city) * W;
    const gap = r + citySize * 0.42;
    const dy = citySize * 0.95;
    const opts: {side: CityLabelSide; box: PlacedLabel}[] = [
      {side: 'r', box: {x: x + gap, y: y - citySize * 0.6, w: tw, h: citySize * 1.2}},
      {side: 'l', box: {x: x - gap - tw, y: y - citySize * 0.6, w: tw, h: citySize * 1.2}},
      {side: 'tr', box: {x: x + gap * 0.5, y: y - dy - citySize * 0.6, w: tw, h: citySize * 1.2}},
      {side: 'br', box: {x: x + gap * 0.5, y: y + dy - citySize * 0.6, w: tw, h: citySize * 1.2}},
      {side: 'tl', box: {x: x - gap * 0.5 - tw, y: y - dy - citySize * 0.6, w: tw, h: citySize * 1.2}},
      {side: 'bl', box: {x: x - gap * 0.5 - tw, y: y + dy - citySize * 0.6, w: tw, h: citySize * 1.2}},
      {side: 't', box: {x: x - tw / 2, y: y - gap - citySize, w: tw, h: citySize * 1.2}},
      {side: 'b', box: {x: x - tw / 2, y: y + gap * 0.4, w: tw, h: citySize * 1.2}},
    ];
    const fit = opts.find(
      (o) =>
        o.box.x > 8 &&
        o.box.x + o.box.w < W - 8 &&
        o.box.y > 8 &&
        o.box.y + o.box.h < H - 8 &&
        !cityPlaced.some((p) => overlaps(p, o.box))
    );
    if (!fit && !capital) {
      droppedCities.push(`${label} (no room for the label)`);
      return false;
    }
    if (fit) cityPlaced.push(fit.box);
    else droppedCities.push(`${label} (marker kept, label crowded out)`);
    cityPlaced.push({x: x - r * 2, y: y - r * 2, w: r * 4, h: r * 4});
    cities.push({name: label, x, y, capital, side: (fit ?? opts[0]).side});
    return true;
  };

  // The capital goes down before anything else, so its label is never the one
  // crowded out by the country name.
  if (capitalFeature) placeCity(capitalFeature);

  // The country name sits at the country's visual centre, which is very often
  // exactly where the capital and the largest cities are. Offer the name a few
  // positions along the country's axis and keep the one that covers least.
  const titleBoxAt = (y: number): PlacedLabel => ({
    x: title.x - titleW / 2,
    y: y - titleH / 2,
    w: titleW,
    h: titleH,
  });
  // Only the capital is on the board at this point, and it is the one label the
  // name must not sit on. Everything else is placed afterwards and routes around
  // the name, so the name keeps its anchor — the brief wants it over the
  // country's interior, not wherever there happens to be least traffic.
  const cost = (y: number) => cityPlaced.filter((p) => overlaps(p, titleBoxAt(y))).length;
  const room = titleH;
  let bestY = title.y;
  let bestCost = cost(title.y);
  for (const y of [title.y - room, title.y + room, title.y - room * 1.8, title.y + room * 1.8]) {
    if (bestCost === 0) break;
    if (y - titleH / 2 < bb.y - titleH * 0.3 || y + titleH / 2 > bb.y + bb.h + titleH * 0.3) continue;
    const c = cost(y);
    if (c < bestCost) {
      bestCost = c;
      bestY = y;
    }
  }
  // Keep the name inside the frame and within the country's middle band: on a
  // 4 000 km-long subject the clearance peak can sit right at the top edge.
  const yLo = Math.max(titleH * 0.75, bb.y + bb.h * 0.1);
  const yHi = Math.min(H - titleH * 0.75, bb.y + bb.h * 0.9);
  title.y = Math.max(Math.min(bestY, Math.max(yLo, yHi)), Math.min(yLo, yHi));

  // The name is the dominant type in frame, so its box is reserved before the
  // remaining cities: their labels route around it rather than under it.
  cityPlaced.push(titleBoxAt(title.y));

  for (const f of chosen) {
    if (cities.length >= 14) break;
    if (f === capitalFeature) continue;
    placeCity(f);
  }
  if (!cities.some((c) => c.capital)) warnings.push('no capital marker in frame');

  // The shortlist the placer worked from, before collisions thinned it. This is
  // what sync-cities writes back: baking only the survivors would narrow the
  // pool a little more on every pass and a city dropped once could never return.
  const cityCandidates = chosen
    .slice(0, 20)
    .map((f) => prop(f, 'NAME') || prop(f, 'NAME_EN'))
    .filter(Boolean);

  // 7. Relief. Warped into the composition's exact pixel grid, once per palette.
  const relief = await getRelief();
  const density = sourceDensity(projection, W, H, relief.width, relief.height);
  const outScale = Math.max(0.5, Math.min(1.25, density * 1.5));
  const reliefW = Math.round((W * outScale) / 2) * 2;
  const reliefH = Math.round((H * outScale) / 2) * 2;

  for (const [key, variant] of Object.entries(RELIEF_VARIANTS)) {
    const buf = warpRelief(relief, {
      projection,
      frameWidth: W,
      frameHeight: H,
      outWidth: reliefW,
      outHeight: reliefH,
      dark: hexToRgb(variant.dark),
      light: hexToRgb(variant.light),
    });
    let pipe = sharp(buf, {raw: {width: reliefW, height: reliefH, channels: 3}});
    // Where the 1:10m relief grid is coarser than the frame, a light unsharp
    // keeps the terrain reading as texture instead of mush.
    if (density < 0.8) pipe = pipe.sharpen({sigma: 0.7, m1: 0.4, m2: 0.9});
    await pipe
      .jpeg({quality: 80, chromaSubsampling: '4:4:4', mozjpeg: true})
      .toFile(path.join(RELIEF_OUT, `${cfg.code}_${key}.jpg`));
  }

  // 8. V3 satellite zoom.
  const v3 = cfg.v3 ? await buildSatellite(cfg, geometry, parts.geometry, name, iso2, warnings) : null;

  const region = {
    titleMaxWidth: titleLimit,
    code: cfg.code,
    name,
    displayName: name.toUpperCase(),
    framing,
    paths: {
      land: d(landInFrame),
      lakes: d(lakesInFrame),
      coast: d(coastInFrame),
      borders: d(bordersInFrame),
      subject: d(geometry),
    },
    subjectBBox,
    fitBBox: fitRingsProjected.length ? ringsBBox(fitRingsProjected) : subjectBBox,
    title,
    neighbourLabels,
    marineLabels,
    cities,
    cityCandidates,
    relief: {
      width: reliefW,
      height: reliefH,
      files: Object.fromEntries(
        Object.keys(RELIEF_VARIANTS).map((k) => [k, `relief/${cfg.code}_${k}.jpg`])
      ),
    },
    v3,
  };

  mkdirSync(path.join(DATA_OUT, 'regions'), {recursive: true});
  writeFileSync(
    path.join(DATA_OUT, 'regions', `${cfg.code}.json`),
    JSON.stringify(region)
  );

  reports.push({
    code: cfg.code,
    name,
    projection:
      framing.kind === 'conicConformal'
        ? `conic ${framing.parallels!.map((p) => p.toFixed(0)).join('/')}`
        : 'mercator',
    partsKept: `${parts.kept}/${parts.total}`,
    cities: cities.length,
    droppedCities,
    reliefPx: `${reliefW}x${reliefH}`,
    reliefUpscale: Number((1 / Math.min(1, density)).toFixed(2)),
    v3: v3
      ? {
          zoomFactor: v3.zoomFactor,
          endSpanKm: v3.endSpanKm,
          endMetresPerPixel: v3.endMetresPerPixel,
          sourceMetresPerPixel: v3.sourceMetresPerPixel,
          upscale: v3.upscale,
          flagFill: Boolean(v3.flag),
          flagRatioOk: v3.flagRatioOk,
        }
      : null,
    warnings,
  });

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `${cities.length} cities  ${neighbourLabels.length} neighbours  relief ${reliefW}x${reliefH}` +
      `${v3 ? `  v3 ${v3.zoomFactor.toFixed(0)}x` : '  v3 skipped'}  (${secs}s)` +
      (warnings.length ? `  ⚠ ${warnings.length}` : '')
  );
};

// ── V3 ─────────────────────────────────────────────────────────────────────

const PLANE_WIDTH = 4096;

const buildSatellite = async (
  cfg: CountryConfig,
  drawGeometry: AnyGeometry,
  fitGeometry: AnyGeometry,
  name: string,
  iso2: string,
  warnings: string[]
) => {
  if (!cfg.v3) return null;
  const {geoEquirectangular} = await import('d3-geo');
  const [[w, s], [e, n]] = geoBounds(fitGeometry as never);
  const span = w > e ? 360 - (w - e) : e - w;
  const lon0 = normLon(w + span / 2);

  const plane = geoEquirectangular()
    .rotate([-lon0, 0, 0])
    .translate([PLANE_WIDTH / 2, PLANE_WIDTH / 4])
    .scale(PLANE_WIDTH / (2 * Math.PI))
    .precision(0.1) as GeoProjection;

  const rings = collectRings(plane, drawGeometry);
  const fitRings = collectRings(plane, fitGeometry);
  const bbox = ringsBBox(fitRings.length ? fitRings : rings);
  const planePath = geoPath(plane).digits(2)(drawGeometry as never) ?? '';

  const lat0 = (s + n) / 2;
  // Equirectangular over-stretches longitude away from the equator. Easing an
  // x-squeeze in as the zoom deepens lands the closing frame on locally correct
  // proportions while the opening frame stays a true world view.
  const kx = Math.max(0.45, Math.min(1, Math.cos((lat0 * Math.PI) / 180)));

  const context = cfg.v3.context ?? 3;
  const openScale = (H * 1.06) / (PLANE_WIDTH / 2);
  const endScale = Math.min(
    W / (bbox.w * kx * context),
    H / (bbox.h * context)
  );
  const zoomFactor = endScale / openScale;

  // The closing window, in real degrees, and what it costs in resolution.
  const endHalfW = W / 2 / (endScale * kx);
  const endHalfH = H / 2 / endScale;
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const degPerPlanePx = 360 / PLANE_WIDTH;
  const endSpanDeg = endHalfW * 2 * degPerPlanePx;
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  const endSpanKm = (endSpanDeg / 360) * (EARTH_CIRCUMFERENCE_M / 1000) * cosLat;
  // Demand is per axis; the tighter one is what actually softens.
  const endSpanKmV =
    ((endHalfH * 2 * degPerPlanePx) / 360) * (EARTH_CIRCUMFERENCE_M / 1000);
  const endMetresPerPixel = Math.min((endSpanKm * 1000) / W, (endSpanKmV * 1000) / H);

  const sat = await getSatMeta();
  // Equirectangular ground resolution: full circumference across the width in x
  // (shrinking with latitude), half of it across the height in y.
  const sourceMetresPerPixel = Math.max(
    (EARTH_CIRCUMFERENCE_M / sat.width) * cosLat,
    EARTH_CIRCUMFERENCE_M / 2 / sat.height
  );
  const upscale = Number((sourceMetresPerPixel / endMetresPerPixel).toFixed(2));
  if (upscale > 3.2) {
    warnings.push(
      `V3 closing frame upscales the satellite base ${upscale}x — consider a larger context`
    );
  }

  // The close-up crop: the closing window with margin, resampled once here with
  // a proper filter rather than left to the browser at render time. The margin
  // has to be large enough that the crop already covers the frame by the time it
  // reaches full opacity, so the fade timing is derived from it rather than fixed.
  const cropMargin = 2.2;
  const cropFadeEnd =
    zoomFactor > 1.05
      ? Math.max(0.3, Math.min(0.78, 1 - Math.log(cropMargin) / Math.log(zoomFactor)))
      : 0.3;
  const lonA = normLon(lon0 + (cx - endHalfW * cropMargin - PLANE_WIDTH / 2) * degPerPlanePx);
  const lonB = normLon(lon0 + (cx + endHalfW * cropMargin - PLANE_WIDTH / 2) * degPerPlanePx);
  const latB = 90 - (cy - endHalfH * cropMargin) * degPerPlanePx;
  const latA = 90 - (cy + endHalfH * cropMargin) * degPerPlanePx;

  const clampLat = (l: number) => Math.max(-90, Math.min(90, l));
  const top = Math.round(((90 - clampLat(latB)) / 180) * sat.height);
  const bottom = Math.round(((90 - clampLat(latA)) / 180) * sat.height);
  let left = Math.round(((lonA + 180) / 360) * sat.width);
  let right = Math.round(((lonB + 180) / 360) * sat.width);
  const wrapped = right <= left;
  if (wrapped) right += sat.width;

  // A closing frame that spans most of the globe gets no close-up crop: the world
  // layer is already at the right resolution for it, and a near-global "crop"
  // would only cost bytes.
  const cropSpanDeg = endSpanDeg * cropMargin;
  const skipCrop = cropSpanDeg >= 330;
  const cropSrcW = Math.min(right - left, sat.width);
  const clampY = (v: number) => Math.max(0, Math.min(sat.height, v));
  const topC = clampY(top);
  const cropSrcH = Math.max(2, clampY(bottom) - topC);
  const outW = Math.max(1600, Math.min(5400, Math.round(cropSrcW * 2)));
  const outH = Math.max(2, Math.round((outW * cropSrcH) / cropSrcW));

  if (process.env.DEBUG_CROP) {
    console.log('\n  crop debug', {left, right, wrapped, cropSrcW, topC, cropSrcH, outW, outH, skipCrop, satW: sat.width, satH: sat.height});
  }
  const cropFile = `satellite/${cfg.code}.jpg`;
  const cropPath = path.join(ROOT, 'public', cropFile);
  if (!skipCrop) {
    // The window can run off the right edge of the source and wrap; take it as
    // one or two extracts and join them before resampling.
    const aW = Math.min(sat.width - left, cropSrcW);
    const bW = cropSrcW - aW;
    const a = await sharp(SAT_SRC, {limitInputPixels: false})
      .extract({left, top: topC, width: aW, height: cropSrcH})
      .toBuffer();
    let joined = a;
    if (bW > 0) {
      const b = await sharp(SAT_SRC, {limitInputPixels: false})
        .extract({left: 0, top: topC, width: bW, height: cropSrcH})
        .toBuffer();
      // The join has to finish before the resize: sharp resizes its input first
      // and would then reject overlays larger than the resized canvas.
      joined = await sharp({
        create: {
          width: cropSrcW,
          height: cropSrcH,
          channels: 3,
          background: {r: 0, g: 0, b: 0},
        },
      })
        .composite([
          {input: a, left: 0, top: 0},
          {input: b, left: aW, top: 0},
        ])
        .png({compressionLevel: 0})
        .toBuffer();
    }
    const {data: cropData} = await sharp(joined, {limitInputPixels: false})
      .resize(outW, outH, {kernel: 'lanczos3'})
      .removeAlpha()
      .raw()
      .toBuffer({resolveWithObject: true});
    navyOceans(
      cropData,
      rasteriseLandMask(outW, outH, {
        left,
        top: topC,
        srcW: cropSrcW,
        srcH: cropSrcH,
        srcTotalW: sat.width,
        srcTotalH: sat.height,
      })
    );
    await sharp(cropData, {raw: {width: outW, height: outH, channels: 3}})
      .jpeg({quality: 84, mozjpeg: true})
      .toFile(cropPath);
  }

  // Where that crop sits on the plane. Derived from the pixel window actually
  // extracted, so a window clipped at a pole still lands in the right place.
  const cropRect = skipCrop
    ? null
    : {
        x: cx - endHalfW * cropMargin,
        y: (topC / sat.height) * (PLANE_WIDTH / 2),
        w: cropSrcW * (PLANE_WIDTH / sat.width),
        h: (cropSrcH / sat.height) * (PLANE_WIDTH / 2),
      };

  // The world layer is drawn three times side by side so the plane can be
  // centred on any meridian without a seam.
  const worldX = PLANE_WIDTH / 2 - ((lon0 + 180) / 360) * PLANE_WIDTH;

  // Flag fill.
  let flag: {
    viewBox: number[];
    inner: string;
    rect: {x: number; y: number; w: number; h: number};
  } | null = null;
  let flagRatioOk: boolean | null = null;
  if (cfg.v3.flagFill) {
    const flagFile = path.join(CACHE, 'flags', `${iso2}.svg`);
    if (!existsSync(flagFile)) {
      warnings.push(`flag SVG missing for ${iso2} — flag fill disabled`);
    } else {
      const f = prepareFlag(flagFile, `fl${cfg.code}_`);
      const official = OFFICIAL_RATIOS[cfg.code];
      if (official) {
        flagRatioOk = Math.abs(f.ratio - official) / official < 0.01;
        if (!flagRatioOk) {
          warnings.push(
            `flag ratio ${f.ratio.toFixed(3)} vs official ${official.toFixed(3)} ` +
              `(${(((f.ratio - official) / official) * 100).toFixed(1)}%)`
          );
        }
      }
      // object-fit: cover. The flag keeps its own proportions and is cropped by
      // the silhouette — never stretched to the country's bounding box. Cover is
      // computed against the framed body, not every distant island, so the flag
      // is centred on the country you can actually see.
      const bb = bbox;
      const scale = Math.max(bb.w / f.viewBox[2], bb.h / f.viewBox[3]);
      const fw = f.viewBox[2] * scale;
      const fh = f.viewBox[3] * scale;
      flag = {
        viewBox: f.viewBox,
        inner: f.inner,
        // Drawn as a nested <svg>, so the flag keeps its own viewport and any
        // percentage units inside it resolve against the flag, not the map.
        rect: {
          x: bb.x + (bb.w - fw) / 2,
          y: bb.y + (bb.h - fh) / 2,
          w: fw,
          h: fh,
        },
      };
    }
  }

  // The label is placed low in the country rather than dead centre. Most flags
  // put their emblem in the middle, and cover-cropping centres it on the country
  // — so the visual centre is exactly where the label would fight the artwork.
  const anchor = labelAnchor(rings, PLANE_WIDTH, PLANE_WIDTH / 2, 256);
  const titleAnchor = (() => {
    if (!anchor) return null;
    const drop = ringsBBox(rings).h * 0.26;
    for (const dy of [drop, drop * 0.6, drop * 1.4, 0]) {
      if (pointInRings(rings, anchor.x, anchor.y + dy)) return {x: anchor.x, y: anchor.y + dy};
    }
    return anchor;
  })();

  return {
    planeWidth: PLANE_WIDTH,
    lon0,
    kx,
    openScale,
    endScale,
    zoomFactor: Number(zoomFactor.toFixed(2)),
    openCenter: [PLANE_WIDTH / 2, PLANE_WIDTH / 4] as [number, number],
    endCenter: [cx, cy] as [number, number],
    subjectPath: planePath,
    subjectBBox: ringsBBox(rings),
    title: titleAnchor
      ? {x: titleAnchor.x, y: titleAnchor.y}
      : {x: cx, y: cy},
    world: {file: 'satellite/world.jpg', x: worldX, y: 0, w: PLANE_WIDTH, h: PLANE_WIDTH / 2},
    crop: cropRect ? {file: cropFile, ...cropRect} : null,
    cropFadeEnd,
    flag,
    flagRatioOk,
    endSpanKm: Number(endSpanKm.toFixed(0)),
    endMetresPerPixel: Number(endMetresPerPixel.toFixed(0)),
    sourceMetresPerPixel: Number(sourceMetresPerPixel.toFixed(0)),
    upscale,
  };
};

// ── world layer + grain ────────────────────────────────────────────────────

/**
 * Scanline-fill the Natural Earth land polygons into a mask covering an
 * arbitrary window of the global equirectangular grid. Used to hold the oceans
 * to a flat navy in the satellite layers while leaving the land in true colour —
 * done here once rather than as a clip path over a world-scale coastline at
 * render time.
 */
interface MaskWindow {
  /** Window origin and size in source-raster pixels. */
  left: number;
  top: number;
  srcW: number;
  srcH: number;
  srcTotalW: number;
  srcTotalH: number;
}

const rasteriseLandMask = (width: number, height: number, win?: MaskWindow): Uint8Array => {
  const w: MaskWindow = win ?? {
    left: 0,
    top: 0,
    srcW: width,
    srcH: height,
    srcTotalW: width,
    srcTotalH: height,
  };
  const sx = width / w.srcW;
  const sy = height / w.srcH;
  const mask = new Uint8Array(width * height);
  const edges: {x0: number; y0: number; x1: number; y1: number}[] = [];
  for (const f of land.features) {
    for (const poly of explodePolygons(f.geometry)) {
      for (const ring of poly) {
        // Unwrap each ring against its own first vertex so a window that
        // straddles the antimeridian still rasterises as one continuous shape.
        let ref = NaN;
        const pts = ring.map(([lon, lat]) => {
          let gx = ((lon + 180) / 360) * w.srcTotalW;
          if (Number.isFinite(ref)) {
            while (gx - ref > w.srcTotalW / 2) gx -= w.srcTotalW;
            while (ref - gx > w.srcTotalW / 2) gx += w.srcTotalW;
          }
          ref = gx;
          const gy = ((90 - lat) / 180) * w.srcTotalH;
          return [gx, gy] as [number, number];
        });
        // The window may sit one wrap away from where the ring landed.
        for (const shift of [-w.srcTotalW, 0, w.srcTotalW]) {
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const x0 = (pts[j][0] + shift - w.left) * sx;
            const y0 = (pts[j][1] - w.top) * sy;
            const x1 = (pts[i][0] + shift - w.left) * sx;
            const y1 = (pts[i][1] - w.top) * sy;
            if (y0 !== y1) edges.push({x0, y0, x1, y1});
          }
        }
      }
    }
  }
  const xs: number[] = [];
  for (let y = 0; y < height; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (const e of edges) {
      if (sy >= Math.min(e.y0, e.y1) && sy < Math.max(e.y0, e.y1)) {
        xs.push(e.x0 + ((sy - e.y0) / (e.y1 - e.y0)) * (e.x1 - e.x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.max(0, Math.ceil(xs[i] - 0.5));
      const b = Math.min(width - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = a; x <= b; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
};

/** Oceans to dark navy, keeping a little of the bathymetry as tone. Applied to
 *  the world layer and to every close-up crop, so the two match through the cut. */
const navyOceans = (data: Buffer | Uint8Array, mask: Uint8Array) => {
  const navy = [8, 18, 34];
  for (let i = 0, p = 0; i < mask.length; i++, p += 3) {
    if (mask[i]) continue;
    const lum = (data[p] * 0.3 + data[p + 1] * 0.59 + data[p + 2] * 0.11) / 255;
    const k = 0.72 + 0.55 * lum;
    data[p] = Math.min(255, navy[0] * k + 6);
    data[p + 1] = Math.min(255, navy[1] * k + 8);
    data[p + 2] = Math.min(255, navy[2] * k + 12);
  }
};

const buildWorld = async () => {
  const out = path.join(SAT_OUT, 'world.jpg');
  process.stdout.write('world satellite layer ... ');
  const width = 5400;
  const height = 2700;
  const {data} = await sharp(SAT_SRC, {limitInputPixels: false})
    .resize(width, height, {kernel: 'lanczos3'})
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});

  const mask = rasteriseLandMask(width, height);
  navyOceans(data, mask);
  await sharp(data, {raw: {width, height, channels: 3}})
    .jpeg({quality: 84, mozjpeg: true})
    .toFile(out);
  console.log(`${width}x${height}`);
};

const buildGrain = async () => {
  const size = 256;
  const buf = Buffer.alloc(size * size);
  let seed = 20260908;
  for (let i = 0; i < buf.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    buf[i] = 96 + ((seed >>> 16) & 0x3f);
  }
  await sharp(buf, {raw: {width: size, height: size, channels: 1}})
    .png({compressionLevel: 9})
    .toFile(path.join(ROOT, 'public', 'grain.png'));
};

/**
 * A static index of every baked region, so the compositions can import the JSON
 * directly. Regenerated from whatever is on disk, which is what lets you rebuild
 * a single country without dropping the rest.
 */
const writeRegionIndex = () => {
  const dir = path.join(DATA_OUT, 'regions');
  const codes = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
  const lines = [
    '// GENERATED by scripts/build-assets.ts — do not edit.',
    "import type {Region} from '../regionTypes';",
    '',
    ...codes.map((c) => `import ${c} from './regions/${c}.json';`),
    '',
    'export const REGIONS = {',
    ...codes.map((c) => `  ${c}: ${c} as unknown as Region,`),
    '} as const satisfies Record<string, Region>;',
    '',
    'export type RegionCode = keyof typeof REGIONS;',
    '',
    'export const hasRegion = (code: string): code is RegionCode =>',
    '  Object.prototype.hasOwnProperty.call(REGIONS, code);',
    '',
  ];
  writeFileSync(path.join(DATA_OUT, 'index.ts'), lines.join('\n'));
  console.log(`\nRegion index: ${codes.length} countries.`);
};

// ── main ───────────────────────────────────────────────────────────────────

const main = async () => {
  for (const dir of [DATA_OUT, RELIEF_OUT, SAT_OUT, path.join(DATA_OUT, 'regions')]) {
    mkdirSync(dir, {recursive: true});
  }

  if (targets.some((c) => c.v3) && !existsSync(path.join(SAT_OUT, 'world.jpg'))) {
    await buildWorld();
  }
  if (!existsSync(path.join(ROOT, 'public', 'grain.png'))) await buildGrain();

  for (const cfg of targets) {
    await buildCountry(cfg);
  }

  writeRegionIndex();

  writeFileSync(
    path.join(DATA_OUT, 'build-report.json'),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        satelliteSource: satelliteSource.satellite,
        countries: reports,
      },
      null,
      2
    )
  );

  const warned = reports.filter((r) => r.warnings.length);
  console.log(`\nBuilt ${reports.length} countries.`);
  if (warned.length) {
    console.log('\nWarnings:');
    for (const r of warned) for (const w of r.warnings) console.log(`  ${r.code}: ${w}`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
