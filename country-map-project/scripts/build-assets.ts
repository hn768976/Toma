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
import {
  COMP_HEIGHT,
  COMP_WIDTH,
  DEFAULT_FINAL_ZOOM,
  MARKER,
  TITLE_PAD,
  TYPE,
  WEIGHT,
} from '../src/layout';
import {fitFontSize, measureText} from './lib/text';
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

/**
 * How far the satellite base may be upscaled in the closing frame before the
 * zoom is pulled back. The brief's own benchmark is ~2x with full-resolution
 * Blue Marble; 2.6 is the ceiling here because the shipped base is Natural
 * Earth II, which is about 4x coarser (see README -> Satellite base).
 */
const MAX_SATELLITE_UPSCALE = 2.6;

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

interface CityLabel {
  name: string;
  x: number;
  y: number;
  capital: boolean;
  /** Baked label anchor point and text-anchor, so the composition draws exactly
   *  what the offline solver decided. */
  lx: number;
  ly: number;
  anchor: 'start' | 'end' | 'middle';
  /** True when the label had to be pushed out and needs a leader line. */
  leader: boolean;
}

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
  namePosition: [number, number];
  titleFontSize: number;
  titleFace: string;
  titleShrunk: boolean;
  leaderLines: number;
  droppedCities: string[];
  reliefPx: string;
  reliefUpscale: number;
  v3: null | {
    finalZoom: number;
    requestedFinalZoom: number;
    zoomFactor: number;
    endSpanKm: number;
    endMetresPerPixel: number;
    sourceMetresPerPixel: number;
    upscale: number;
    flagFill: boolean;
    flagRatioOk: boolean | null;
    flagCovers: boolean | null;
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
  const fitBBox = fitRingsProjected.length ? ringsBBox(fitRingsProjected) : subjectBBox;
  const anchor = labelAnchor(subjectRings, W, H) ?? {
    x: subjectBBox.x + subjectBBox.w / 2,
    y: subjectBBox.y + subjectBBox.h / 2,
    clearance: 0,
  };
  const [tox, toy] = cfg.framing?.titleOffset ?? [0, 0];
  const title = {x: anchor.x + tox * W, y: anchor.y + toy * H};
  const bb = subjectBBox;

  // 6. Cities. Names resolve to Natural Earth coordinates — never typed by hand.
  const SETTLEMENT = /^(populated place|admin-\d|admin-\d region capital|admin-0 capital alt)/i;
  const candidates = places.features.filter(
    (f) =>
      (prop(f, 'ADM0_A3') === cfg.code || prop(f, 'SOV_A3') === cfg.code) &&
      SETTLEMENT.test(prop(f, 'FEATURECLA'))
  );
  const isCapital = (f: Feature) => prop(f, 'FEATURECLA').toLowerCase().includes('admin-0 capital');
  const capitalFeature = candidates.find(isCapital);
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
  if (capitalFeature && !chosen.includes(capitalFeature)) chosen.unshift(capitalFeature);

  const citySize = TYPE.city * W;
  const titleFace = cfg.titleFace ?? 'semi';
  const titleText = name.toUpperCase();

  // ── the country name goes down FIRST ─────────────────────────────────────
  // It is a first-class occupant of the layout, not an overlay: its box is a
  // fixed obstacle that every city label — the capital included — routes around.
  //
  // Sized to the frame, then capped against the country it sits on so a small
  // subject does not end up with type spilling out into the sea. Barlow Semi
  // Condensed is narrow enough that the cap almost never bites; where a name is
  // long enough that it would, set `titleFace: 'condensed'` on the entry rather
  // than accepting smaller type.
  const titleLimit = Math.min(
    TYPE.titleMaxWidthFrac * W,
    Math.max(fitBBox.w * 1.15, 0.28 * W)
  );
  const titleStyle = {
    face: titleFace,
    weight: WEIGHT.title,
    letterSpacing: TYPE.titleLetterSpacing,
  } as const;
  const titleFontSize = fitFontSize(titleText, titleLimit, TYPE.title * W, titleStyle);
  const titleShrunk = titleFontSize < TYPE.title * W - 0.5;
  if (titleShrunk) {
    warnings.push(
      `country name set down to ${titleFontSize.toFixed(0)}px from ${(TYPE.title * W).toFixed(0)}px ` +
        `to fit — consider titleFace: 'condensed'`
    );
  }
  const titleW = measureText(titleText, {...titleStyle, fontSize: titleFontSize});
  const titleH = titleFontSize * 1.1;
  const pad = TITLE_PAD * W;

  // Position: the per-country override if there is one, otherwise the point of
  // greatest clearance inside the country, expressed normalised so it can be
  // written back into the data file and reviewed.
  // The automatic position is the point of greatest clearance inside the
  // country, nudged clear of the capital's marker if it lands on it — a capital
  // at the visual centre of its own country is the common case, and a marker
  // sitting inside a letterform reads as a mistake even when the leader line
  // rescues the label. A manual `namePosition` is taken verbatim: it is the
  // author's word, and the whole point of the override.
  const capitalPt = capitalFeature
    ? projection([num(capitalFeature, 'LONGITUDE'), num(capitalFeature, 'LATITUDE')])
    : null;
  let autoX = anchor.x;
  let autoY = anchor.y;
  if (capitalPt) {
    const halfW = measureText(titleText, {...titleStyle, fontSize: TYPE.title * W}) / 2;
    const halfH = (TYPE.title * W * 1.1) / 2;
    const onCapital =
      Math.abs(capitalPt[0] - autoX) < halfW + citySize * 0.6 &&
      Math.abs(capitalPt[1] - autoY) < halfH + citySize * 0.6;
    if (onCapital) {
      const shift = halfH + citySize * 1.1;
      const up = autoY - shift > fitBBox.y + fitBBox.h * 0.06;
      autoY += capitalPt[1] > autoY || !up ? shift : -shift;
    }
  }
  const npAuto: [number, number] = [
    fitBBox.w > 0 ? (autoX - fitBBox.x) / fitBBox.w : 0.5,
    fitBBox.h > 0 ? (autoY - fitBBox.y) / fitBBox.h : 0.5,
  ];
  const namePosition: [number, number] = cfg.namePosition ?? [
    Number(npAuto[0].toFixed(3)),
    Number(npAuto[1].toFixed(3)),
  ];
  title.x = fitBBox.x + namePosition[0] * fitBBox.w;
  title.y = fitBBox.y + namePosition[1] * fitBBox.h;

  // Keep it inside the frame whatever the override says.
  title.x = Math.max(titleW / 2 + pad, Math.min(W - titleW / 2 - pad, title.x));
  title.y = Math.max(titleH * 0.75, Math.min(H - titleH * 0.75, title.y));

  const titleBox: PlacedLabel = {
    x: title.x - titleW / 2 - pad,
    y: title.y - titleH / 2 - pad,
    w: titleW + pad * 2,
    h: titleH + pad * 2,
  };

  // ── everything else that carries type ────────────────────────────────────
  // Placed after the country name, against its box: the name is a first-class
  // occupant of the layout and every other label routes around it, sea and
  // neighbour names included.
  const placed: PlacedLabel[] = [titleBox];

  // Neighbours: every other country with territory in frame, labelled inside
  //    whatever part of it is actually visible.
  const neighbourFeatures = countries.features.filter(
    (f) => prop(f, 'ADM0_A3') !== cfg.code && inFrame(f)
  );
  const neighbourLabels: {name: string; x: number; y: number}[] = [];
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
    const tw = measureText(label, {
      fontSize: neighbourSize,
      weight: WEIGHT.neighbour,
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
    const tw = measureText(label, {
      fontSize: marineSize,
      weight: WEIGHT.marine,
      italic: true,
      letterSpacing: TYPE.marineLetterSpacing,
    });
    if (a.clearance * 2 < tw * 0.5) continue;
    if (a.x - tw / 2 < 12 || a.x + tw / 2 > W - 12) continue;
    const box = {x: a.x - tw / 2, y: a.y - marineSize / 2, w: tw, h: marineSize * 1.4};
    if (placed.some((p) => overlaps(p, box))) continue;
    placed.push(box);
    marineLabels.push({name: label, x: a.x, y: a.y});
  }


  // ── city markers and labels ──────────────────────────────────────────────
  const cityPlaced: PlacedLabel[] = [titleBox];
  const cities: CityLabel[] = [];
  const edge = W * 0.02;
  const reach = MARKER.leaderReach * W;

  /**
   * Place one city. Eight adjacent slots first; if every one of them collides,
   * push the label out on a leader line rather than dropping the city — the same
   * treatment a cartographer gives a crowded coastline.
   */
  const placeCity = (f: Feature): boolean => {
    const pt = projection([num(f, 'LONGITUDE'), num(f, 'LATITUDE')]);
    if (!pt) return false;
    const [x, y] = pt;
    if (x < edge || x > W - edge || y < edge || y > H - edge) return false;
    const label = prop(f, 'NAME') || prop(f, 'NAME_EN');
    const capital = isCapital(f);
    const tw = measureText(label, {
      fontSize: citySize,
      weight: capital ? WEIGHT.capital : WEIGHT.city,
    });
    const r = (capital ? MARKER.capital : MARKER.city) * W;
    const gap = r + citySize * 0.42;
    const dy = citySize * 0.95;
    const th = citySize * 1.15;

    type Slot = {lx: number; ly: number; anchor: 'start' | 'end' | 'middle'; leader: boolean};
    const slot = (lx: number, ly: number, anchor: Slot['anchor'], leader = false): Slot => ({
      lx,
      ly,
      anchor,
      leader,
    });
    const boxOf = (sl: Slot): PlacedLabel => ({
      x: sl.anchor === 'start' ? sl.lx : sl.anchor === 'end' ? sl.lx - tw : sl.lx - tw / 2,
      y: sl.ly - th / 2,
      w: tw,
      h: th,
    });

    const adjacent: Slot[] = [
      slot(x + gap, y, 'start'),
      slot(x - gap, y, 'end'),
      slot(x + gap * 0.5, y - dy, 'start'),
      slot(x + gap * 0.5, y + dy, 'start'),
      slot(x - gap * 0.5, y - dy, 'end'),
      slot(x - gap * 0.5, y + dy, 'end'),
      slot(x, y - gap - citySize * 0.4, 'middle'),
      slot(x, y + gap + citySize * 0.4, 'middle'),
    ];
    // Leader-line slots: further out, in eight directions.
    const extended: Slot[] = [];
    for (const [dxr, dyr] of [
      [1, 0], [-1, 0], [1, -1], [1, 1], [-1, -1], [-1, 1], [0, -1], [0, 1],
    ] as const) {
      for (const k of [1, 1.7]) {
        const lx = x + dxr * reach * k;
        const ly = y + dyr * reach * k * 0.7;
        extended.push(
          slot(lx + (dxr >= 0 ? gap * 0.2 : -gap * 0.2), ly, dxr >= 0 ? 'start' : dxr < 0 ? 'end' : 'middle', true)
        );
      }
    }

    // Escape slots: where the marker sits inside the country name's box — a
    // capital at the centre of its own country, most often — the ordinary leader
    // reach cannot get clear of it. These land just outside the box, so the name
    // being placed first never costs a label.
    const escapes: Slot[] = [];
    const inTitle =
      x > titleBox.x && x < titleBox.x + titleBox.w && y > titleBox.y && y < titleBox.y + titleBox.h;
    if (inTitle) {
      escapes.push(
        slot(titleBox.x - citySize * 0.35, y, 'end', true),
        slot(titleBox.x + titleBox.w + citySize * 0.35, y, 'start', true),
        slot(x, titleBox.y - th * 0.75, 'middle', true),
        slot(x, titleBox.y + titleBox.h + th * 0.75, 'middle', true)
      );
    }

    const fits = (sl: Slot) => {
      const b = boxOf(sl);
      return (
        b.x > 8 &&
        b.x + b.w < W - 8 &&
        b.y > 8 &&
        b.y + b.h < H - 8 &&
        !cityPlaced.some((p) => overlaps(p, b))
      );
    };

    const chosenSlot = adjacent.find(fits) ?? extended.find(fits) ?? escapes.find(fits) ?? null;
    if (!chosenSlot && !capital) {
      droppedCities.push(`${label} (nowhere legible to put the label)`);
      return false;
    }
    const sl = chosenSlot ?? adjacent[0];
    if (chosenSlot) cityPlaced.push(boxOf(sl));
    else droppedCities.push(`${label} (marker kept, label crowded out)`);
    cityPlaced.push({x: x - r * 2, y: y - r * 2, w: r * 4, h: r * 4});

    cities.push({
      name: label,
      x,
      y,
      capital,
      lx: sl.lx,
      ly: sl.ly,
      anchor: sl.anchor,
      leader: Boolean(chosenSlot && sl.leader),
    });
    return true;
  };

  for (const f of chosen) {
    if (cities.length >= 14) break;
    placeCity(f);
  }
  if (!cities.some((c) => c.capital) && capitalFeature) placeCity(capitalFeature);
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
    fitBBox,
    title,
    titleFontSize,
    titleFace,
    namePosition,
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
    namePosition,
    titleFontSize: Number(titleFontSize.toFixed(1)),
    titleFace,
    titleShrunk,
    leaderLines: cities.filter((c) => c.leader).length,
    reliefPx: `${reliefW}x${reliefH}`,
    reliefUpscale: Number((1 / Math.min(1, density)).toFixed(2)),
    v3: v3
      ? {
          finalZoom: v3.finalZoom,
          requestedFinalZoom: v3.requestedFinalZoom,
          zoomFactor: v3.zoomFactor,
          endSpanKm: v3.endSpanKm,
          endMetresPerPixel: v3.endMetresPerPixel,
          sourceMetresPerPixel: v3.sourceMetresPerPixel,
          upscale: v3.upscale,
          flagFill: Boolean(v3.flag),
          flagRatioOk: v3.flagRatioOk,
          flagCovers: v3.flagCovers,
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

  // The closing framing: scale so the country's LONGEST dimension fills
  // `finalZoom` of the corresponding frame dimension. Expressed this way the
  // number means what it says on every country shape — a wide country binds on
  // width, a tall one on height — and the country cannot overflow the frame.
  const requestedFinalZoom = cfg.v3.finalZoom ?? DEFAULT_FINAL_ZOOM;
  const openScale = (H * 1.06) / (PLANE_WIDTH / 2);
  const longest = Math.max((bbox.w * kx) / W, bbox.h / H);

  // Resolution guard. `finalZoom` states the framing you want; the satellite
  // base decides how much of it you can have. Rather than baking a pulled-back
  // number into the data — which would then be wrong the moment a finer base is
  // dropped in — the requested zoom is capped here against the measured upscale
  // and the effective value is reported. Swap in Blue Marble and every country
  // returns to its requested framing with no data edits.
  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);
  const satForGuard = await getSatMeta();
  const srcMpp = Math.max(
    (EARTH_CIRCUMFERENCE_M / satForGuard.width) * cosLat0,
    EARTH_CIRCUMFERENCE_M / 2 / satForGuard.height
  );
  const upscaleAt = (fz: number) => {
    const sc = fz / longest;
    const spanKmH =
      (((W / 2 / (sc * kx)) * 2 * (360 / PLANE_WIDTH)) / 360) *
      (EARTH_CIRCUMFERENCE_M / 1000) *
      cosLat0;
    const spanKmV =
      (((H / 2 / sc) * 2 * (360 / PLANE_WIDTH)) / 360) * (EARTH_CIRCUMFERENCE_M / 1000);
    return srcMpp / Math.min((spanKmH * 1000) / W, (spanKmV * 1000) / H);
  };
  const requestedUpscale = upscaleAt(requestedFinalZoom);
  const guarded =
    cfg.v3.ignoreResolutionGuard || requestedUpscale <= MAX_SATELLITE_UPSCALE
      ? requestedFinalZoom
      : requestedFinalZoom * (MAX_SATELLITE_UPSCALE / requestedUpscale);
  const finalZoom = Number(guarded.toFixed(3));
  if (finalZoom < requestedFinalZoom - 1e-6) {
    warnings.push(
      `V3 ends wider than requested: finalZoom ${requestedFinalZoom} -> ${finalZoom} ` +
        `(satellite base would be upscaled ${requestedUpscale.toFixed(2)}x at the requested depth)`
    );
  }
  const endScale = finalZoom / longest;
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
  let flagCovers: boolean | null = null;
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
      // Assert the cover fit rather than trusting it: the drawn rectangle must
      // carry the flag's own aspect ratio exactly, or the artwork is being
      // stretched. A circular emblem staying circular is the visible symptom.
      const drawnRatio = fw / fh;
      if (Math.abs(drawnRatio - f.ratio) / f.ratio > 1e-6) {
        throw new Error(
          `${cfg.code}: flag would be drawn at ${drawnRatio.toFixed(5)} but its ` +
            `ratio is ${f.ratio.toFixed(5)} — the cover fit is wrong`
        );
      }
      flagCovers = fw >= bb.w - 1e-6 && fh >= bb.h - 1e-6;
      if (!flagCovers) {
        throw new Error(`${cfg.code}: flag does not cover the silhouette`);
      }
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
    flagCovers,
    finalZoom,
    requestedFinalZoom,
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
