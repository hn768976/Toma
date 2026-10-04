import { geoGraticule, geoPath, type GeoProjection } from "d3-geo";
import polylabel from "polylabel";
import { FELL, loadFonts } from "../lib/fonts";
import { makeCameraPath, planFootprint, type CameraPath } from "./camera";
import { loadMapData, type F, type MapData } from "./data";
import { insideRings, projectRings, ringArea, ringsToPath } from "./geometry";
import { BASE_SCALE, makeProjection } from "./projection";
import type { MapRegion } from "./regions";

// The printed map, drawn once per version into Canvas 2D tiles that become
// the textures of the 3D paper plane.

export const MAP_COLORS = {
  land: "#7A4428",
  landDark: "#5A2E1A",
  landLight: "#A06A4C",
  sea: "#E6CFA0",
  seaDark: "#CDAA74",
  seaLight: "#F1E0BC",
  coastInk: "#3B1B0C",
  border: "#D8B58A",
  graticule: "#F8EBCF",
  countryLabel: "#F1DEC0",
  seaLabel: "#4A2414",
  cityLand: "#F3E3C6",
  citySea: "#4A2414",
  offMap: "#D2B482",
  landRim: "#C08A62",
  labelOutline: "#2A1206",
};

export const TILE_SIZE = 4096;
export const TILE_GUTTER = 48;

export type PlacedLabel = {
  kind: "country" | "sea" | "state" | "city";
  text: string;
  owner: string; // ADM0_A3, sea name or state name
  lon: number;
  lat: number;
  rect: [number, number, number, number]; // texture px
};

export type MapTexture = {
  regionId: string;
  width: number;
  height: number;
  // x, y, w, h: the tile's own area in texture px; the canvas is larger by
  // `gutter` on every side.
  tiles: { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number; gutter: number }[];
  // Plane-unit rectangle the texture covers (y up).
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  texelsPerUnit: number;
  path: CameraPath;
  labels: PlacedLabel[];
  stats: Record<string, number>;
};

type Rect = { x0: number; y0: number; x1: number; y1: number };

class Collider {
  private cells = new Map<number, Rect[]>();
  constructor(private cell: number) {}
  private keys(r: Rect) {
    const out: number[] = [];
    const c = this.cell;
    for (let gx = Math.floor(r.x0 / c); gx <= Math.floor(r.x1 / c); gx++)
      for (let gy = Math.floor(r.y0 / c); gy <= Math.floor(r.y1 / c); gy++) out.push(gx * 100003 + gy);
    return out;
  }
  hits(r: Rect) {
    for (const k of this.keys(r)) {
      const list = this.cells.get(k);
      if (!list) continue;
      for (const o of list) if (r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0) return true;
    }
    return false;
  }
  add(r: Rect) {
    for (const k of this.keys(r)) {
      const list = this.cells.get(k);
      if (list) list.push(r);
      else this.cells.set(k, [r]);
    }
  }
}

// Deterministic lattice value noise for the low-frequency ink mottling.
const latticeHash = (x: number, y: number, seed: number) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const valueNoise = (x: number, y: number, seed: number) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = latticeHash(xi, yi, seed), b = latticeHash(xi + 1, yi, seed);
  const c = latticeHash(xi, yi + 1, seed), d = latticeHash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x: number, y: number, seed: number) => {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < 5; o++) {
    s += amp * valueNoise(x * f, y * f, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / norm;
};
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const DISPUTED_TYPES = new Set(["Disputed", "Indeterminate", "Breakaway"]);
const SOLID_BORDER = "International boundary (verify)";
// English names for places Natural Earth gives in a local or outdated form.
const CITY_NAMES: Record<string, string> = {
  "Nur-Sultan": "Astana",
  København: "Copenhagen",
  Banghazi: "Benghazi",
  Zaporizhzhya: "Zaporizhzhia",
  Antwerpen: "Antwerp",
  "Nürnberg": "Nuremberg",
  "Ft. Worth": "Fort Worth",
};
// Natural Earth names that are not printed-atlas sea names.
const SEA_EXCLUDE = new Set(["Inner Seas"]);

const textureCache = new Map<string, Promise<MapTexture>>();

export const getMapTexture = (region: MapRegion, screenWidthPx: number) => {
  const key = `${region.id}@${Math.round(screenWidthPx)}`;
  let p = textureCache.get(key);
  if (!p) {
    p = (async () => {
      await loadFonts();
      const data = await loadMapData(region);
      return buildMapTexture(region, data, screenWidthPx);
    })();
    textureCache.set(key, p);
  }
  return p;
};

export const buildMapTexture = (region: MapRegion, data: MapData, screenWidthPx: number): MapTexture => {
  const t0 = performance.now();
  const base = makeProjection(region);
  const camPath = makeCameraPath(region, base);
  const fp = planFootprint(camPath, screenWidthPx);
  const k = fp.texelsPerUnit;
  const W = Math.ceil((fp.maxX - fp.minX) * k);
  const H = Math.ceil((fp.maxY - fp.minY) * k);
  // Texture pixels per 1/1000 of the visible width: all sizes use this unit
  // so the layout is the same at every render resolution.
  const mv = (camPath.viewWidth * k) / 1000;
  const ls = region.labelScale;

  const proj: GeoProjection = makeProjection(region)
    .scale(BASE_SCALE * k)
    .translate([-fp.minX * k, fp.maxY * k])
    .clipExtent([
      [-0.05 * W, -0.05 * H],
      [1.05 * W, 1.05 * H],
    ]);
  const areaOf = geoPath(proj).area;

  // ---- project geometry ------------------------------------------------
  const countries = data.countries.map((f) => ({ f, rings: projectRings(proj, f) })).filter((c) => c.rings.length);
  const landPath = new Path2D();
  for (const c of countries) ringsToPath(c.rings, true, landPath);
  const coastPath = ringsToPath(data.coast.flatMap((f) => projectRings(proj, f)), false);
  const solidBorders = new Path2D();
  const dashedBorders = new Path2D();
  for (const f of data.borders) ringsToPath(projectRings(proj, f), false, f.properties.FEATURECLA === SOLID_BORDER ? solidBorders : dashedBorders);
  for (const f of data.claims) ringsToPath(projectRings(proj, f), false, dashedBorders);
  const lakeMaxRank = region.dataset === "world" ? 2 : 5;
  const lakeRings = data.lakes.filter((f) => Number(f.properties.scalerank) <= lakeMaxRank).flatMap((f) => projectRings(proj, f));
  const lakePath = ringsToPath(lakeRings, true);
  const stateLinePath = ringsToPath(data.stateLines.flatMap((f) => projectRings(proj, f)), false);
  const graticule = geoGraticule().step([10, 10]).extentMinor([[-180, -80.0001], [180, 80.0001]]);
  const graticulePath = ringsToPath(projectRings(proj, graticule()), false);
  const spherePath = region.projection.type === "naturalEarth1" ? ringsToPath(projectRings(proj, { type: "Sphere" }), true) : null;
  const disputed = data.disputed
    .filter((f) => DISPUTED_TYPES.has(String(f.properties.TYPE)))
    .map((f) => projectRings(proj, f))
    .filter((r) => r.length);
  const inDisputed = (x: number, y: number) => disputed.some((r) => insideRings(r, x, y));

  // ---- land mask (for "is this on land" tests) -------------------------
  const MASK = 8;
  const mw = Math.ceil(W / MASK), mh = Math.ceil(H / MASK);
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = mw;
  maskCanvas.height = mh;
  const mctx = maskCanvas.getContext("2d", { willReadFrequently: true })!;
  mctx.setTransform(1 / MASK, 0, 0, 1 / MASK, 0, 0);
  mctx.fillStyle = "#000";
  mctx.fill(landPath);
  mctx.globalCompositeOperation = "destination-out";
  mctx.fill(lakePath);
  const maskData = mctx.getImageData(0, 0, mw, mh).data;
  const onLand = (x: number, y: number) => {
    const mx = Math.min(mw - 1, Math.max(0, Math.floor(x / MASK)));
    const my = Math.min(mh - 1, Math.max(0, Math.floor(y / MASK)));
    return maskData[(my * mw + mx) * 4 + 3] > 127;
  };

  // ---- mottling images ---------------------------------------------------
  const MOTTLE = 3 * mv; // texture px per mottle pixel
  const ow = Math.ceil(W / MOTTLE) + 2, oh = Math.ceil(H / MOTTLE) + 2;
  const makeMottle = (layers: { color: string; seed: number; freq: number; e0: number; e1: number; alpha: number }[]) => {
    const c = document.createElement("canvas");
    c.width = ow;
    c.height = oh;
    const cx = c.getContext("2d")!;
    const img = cx.createImageData(ow, oh);
    const d = img.data;
    const cols = layers.map((l) => hexRgb(l.color));
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        // noise coordinates in units of the visible width, independent of resolution
        const nx = (x * MOTTLE) / (mv * 1000);
        const ny = (y * MOTTLE) / (mv * 1000);
        let r = 0, g = 0, b = 0, a = 0;
        layers.forEach((l, i) => {
          const n = fbm(nx * l.freq, ny * l.freq, l.seed);
          const al = smooth(l.e0, l.e1, n) * l.alpha;
          // "over" compositing of the layers
          r = cols[i][0] * al + r * (1 - al);
          g = cols[i][1] * al + g * (1 - al);
          b = cols[i][2] * al + b * (1 - al);
          a = al + a * (1 - al);
        });
        const o = (y * ow + x) * 4;
        d[o] = a > 0 ? r / a : 0;
        d[o + 1] = a > 0 ? g / a : 0;
        d[o + 2] = a > 0 ? b / a : 0;
        d[o + 3] = Math.round(a * 255);
      }
    }
    cx.putImageData(img, 0, 0);
    return c;
  };
  const landMottle = makeMottle([
    { color: MAP_COLORS.landLight, seed: 11, freq: 9, e0: 0.45, e1: 0.75, alpha: 0.9 },
    { color: MAP_COLORS.landLight, seed: 13, freq: 30, e0: 0.55, e1: 0.8, alpha: 0.4 },
    { color: MAP_COLORS.landDark, seed: 23, freq: 6, e0: 0.45, e1: 0.72, alpha: 0.85 },
    { color: MAP_COLORS.landDark, seed: 37, freq: 22, e0: 0.55, e1: 0.75, alpha: 0.45 },
  ]);
  const seaMottle = makeMottle([
    { color: MAP_COLORS.seaDark, seed: 41, freq: 5, e0: 0.42, e1: 0.8, alpha: 0.8 },
    { color: MAP_COLORS.seaDark, seed: 47, freq: 26, e0: 0.55, e1: 0.75, alpha: 0.45 },
    { color: MAP_COLORS.seaLight, seed: 53, freq: 8, e0: 0.55, e1: 0.8, alpha: 0.5 },
    { color: MAP_COLORS.seaDark, seed: 67, freq: 18, e0: 0.6, e1: 0.8, alpha: 0.3 },
  ]);

  // ---- labels -----------------------------------------------------------
  const measureCanvas = document.createElement("canvas").getContext("2d")!;
  type Spec = { lines: string[]; size: number; spacing: number; italic: boolean };
  const fontOf = (s: Spec) => `${s.italic ? "italic " : ""}${s.size}px "${FELL}"`;
  const lineHeight = 1.0;
  const measure = (s: Spec) => {
    measureCanvas.font = fontOf(s);
    measureCanvas.letterSpacing = `${s.spacing * s.size}px`;
    const widths = s.lines.map((l) => measureCanvas.measureText(l).width - s.spacing * s.size);
    return { w: Math.max(...widths), h: s.lines.length * s.size * lineHeight };
  };
  const rectAt = (cx: number, cy: number, w: number, h: number): Rect => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
  // Sample grid over a label rectangle, edges included.
  const samples = (r: Rect, lines: number) => {
    const pts: [number, number][] = [];
    const rows = Math.max(3, lines * 3);
    const cols = Math.max(7, Math.ceil(((r.x1 - r.x0) / (r.y1 - r.y0)) * rows));
    for (let i = 0; i <= cols; i++)
      for (let j = 0; j <= rows; j++) pts.push([r.x0 + (i / cols) * (r.x1 - r.x0), r.y0 + (j / rows) * (r.y1 - r.y0)]);
    return pts;
  };
  const inTexture = (r: Rect) => r.x0 > 0 && r.y0 > 0 && r.x1 < W && r.y1 < H;
  const pad = (r: Rect, p: number): Rect => ({ x0: r.x0 - p, y0: r.y0 - p, x1: r.x1 + p, y1: r.y1 + p });

  const collider = new Collider(40 * mv);
  type Draw = { spec: Spec; x: number; y: number; color: string; alpha: number; stroke?: number; outline?: string };
  const draws: Draw[] = [];
  const dots: { x: number; y: number; onLand: boolean }[] = [];
  const placed: PlacedLabel[] = [];
  const stats: Record<string, number> = {};
  const bump = (k: string) => (stats[k] = (stats[k] ?? 0) + 1);

  const splitTwo = (text: string): string[] | null => {
    const words = text.split(" ");
    if (words.length < 2) return null;
    let best: string[] | null = null;
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
      const diff = Math.abs(a.length - b.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = [a, b];
      }
    }
    return best;
  };

  // Try label variants (sizes, one or two lines, alternatives) until one fits
  // inside its own area and clear of every label already placed.
  const tryPlace = (
    texts: string[],
    sizes: number[],
    spacing: number,
    italic: boolean,
    anchor: [number, number],
    fits: (r: Rect, lines: number) => boolean,
  ): { spec: Spec; rect: Rect } | null => {
    for (const text of texts) {
      for (const size of sizes) {
        const variants = [[text]];
        const two = splitTwo(text);
        if (two) variants.push(two);
        for (const lines of variants) {
          const spec = { lines, size, spacing, italic };
          const m = measure(spec);
          const r = rectAt(anchor[0], anchor[1], m.w, m.h);
          if (!inTexture(r)) continue;
          if (collider.hits(pad(r, 0.3 * size))) continue;
          if (!fits(r, lines.length)) continue;
          return { spec, rect: r };
        }
      }
    }
    return null;
  };
  const sizeSteps = (start: number, min: number) => {
    const out: number[] = [];
    for (let s = start; s >= min * 0.999; s *= 0.88) out.push(s);
    if (!out.length) out.push(min);
    return out;
  };
  const noDisputed = (r: Rect, lines: number) => !samples(r, lines).some(([x, y]) => inDisputed(x, y));

  // 1. Sea names
  const seas = data.marine
    .filter(
      (f) =>
        region.seaClasses.includes(String(f.properties.featurecla)) &&
        Number(f.properties.scalerank) <= region.seaMaxRank &&
        !SEA_EXCLUDE.has(String(f.properties.name)),
    )
    .map((f) => ({ f, rings: projectRings(proj, f) }))
    .filter((s) => s.rings.length)
    .map((s) => ({ ...s, area: s.rings.reduce((a, r) => a + Math.abs(ringArea(r)), 0) }))
    .sort((a, b) => Number(a.f.properties.scalerank) - Number(b.f.properties.scalerank) || b.area - a.area);
  for (const s of seas) {
    const raw = String(s.f.properties.name).replace(/\s+/g, " ").trim();
    // a few Natural Earth names are all caps; print them in title case
    const name = raw === raw.toUpperCase() ? raw.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase()) : raw;
    const main = s.rings.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a));
    const poly: number[][] = [];
    for (let i = 0; i < main.pts.length; i += 2) poly.push([main.pts[i], main.pts[i + 1]]);
    const pl = polylabel([poly], 2 * mv) as unknown as [number, number] & { distance: number };
    const anchor: [number, number] = [pl[0], pl[1]];
    if (!insideRings(s.rings, anchor[0], anchor[1]) || onLand(anchor[0], anchor[1])) {
      bump("seaSkippedAnchor");
      continue;
    }
    const size = Math.min(31 * mv, Math.max(17 * mv, pl.distance * 0.42)) * ls;
    const res = tryPlace([name], sizeSteps(size, 12 * mv * ls), 0.02, true, anchor, (r, n) => {
      // dense test over the padded rectangle: no part of the name may touch land
      const pts = samples(pad(r, 1.5 * mv), n * 2);
      return pts.every(([x, y]) => insideRings(s.rings, x, y) && !onLand(x, y)) && noDisputed(r, n);
    });
    if (!res) {
      bump("seaDropped");
      continue;
    }
    collider.add(pad(res.rect, 0.1 * res.spec.size));
    draws.push({ spec: res.spec, x: anchor[0], y: anchor[1], color: MAP_COLORS.seaLabel, alpha: 1, stroke: 0.05 });
    const ll = proj.invert!(anchor)!;
    placed.push({ kind: "sea", text: name, owner: raw, lon: ll[0], lat: ll[1], rect: [res.rect.x0, res.rect.y0, res.rect.x1, res.rect.y1] });
  }

  // 2. Country names
  const countryList = countries
    .map((c) => ({ ...c, area: areaOf(c.f) }))
    .filter((c) => c.area > 0)
    .sort((a, b) => b.area - a.area);
  for (const c of countryList) {
    const p = c.f.properties;
    const a3 = String(p.ADM0_A3);
    if (DISPUTED_TYPES.has(String(p.TYPE))) {
      bump("countrySkippedDisputed");
      continue;
    }
    if (region.hideCountryLabels.includes(a3)) continue;
    let anchor = proj([Number(p.LABEL_X), Number(p.LABEL_Y)]) as [number, number] | null;
    const offTexture = !!anchor && (anchor[0] < 0 || anchor[1] < 0 || anchor[0] > W || anchor[1] > H);
    if (!anchor || offTexture || !insideRings(c.rings, anchor[0], anchor[1])) {
      // fall back to the pole of inaccessibility of the largest ring
      const main = c.rings.reduce((x, y) => (Math.abs(ringArea(y)) > Math.abs(ringArea(x)) ? y : x));
      const poly: number[][] = [];
      for (let i = 0; i < main.pts.length; i += 2) poly.push([main.pts[i], main.pts[i + 1]]);
      const pl = polylabel([poly], 2 * mv) as unknown as [number, number];
      anchor = [pl[0], pl[1]];
      if (!insideRings(c.rings, anchor[0], anchor[1])) continue;
    }
    if (anchor[0] < 0 || anchor[1] < 0 || anchor[0] > W || anchor[1] > H) continue;
    const size = Math.min(34 * mv, Math.max(13 * mv, 0.115 * Math.sqrt(c.area))) * ls;
    const names = [String(p.NAME).toUpperCase()];
    // Abbreviation as a fallback, unless it is too cryptic (fewer than 3 letters).
    const abbrev = String(p.ABBREV ?? "");
    if (abbrev && abbrev !== String(p.NAME) && abbrev.replace(/[^\p{L}]/gu, "").length >= 3) names.push(abbrev.toUpperCase());
    const res = tryPlace(names, sizeSteps(size, 9.5 * mv * ls), 0.12, false, anchor, (r, n) => {
      const pts = samples(r, n);
      const inside = pts.filter(([x, y]) => insideRings(c.rings, x, y)).length;
      return inside / pts.length >= 0.8 && noDisputed(r, n);
    });
    if (!res) {
      bump("countryDropped");
      continue;
    }
    collider.add(pad(res.rect, 0.15 * res.spec.size));
    draws.push({ spec: res.spec, x: anchor[0], y: anchor[1], color: MAP_COLORS.countryLabel, alpha: 0.97, stroke: 0.035, outline: MAP_COLORS.labelOutline });
    const ll = proj.invert!(anchor)!;
    placed.push({ kind: "country", text: res.spec.lines.join(" "), owner: a3, lon: ll[0], lat: ll[1], rect: [res.rect.x0, res.rect.y0, res.rect.x1, res.rect.y1] });
  }

  // 3. States / provinces
  const states = data.states
    .map((f) => ({ f, rings: projectRings(proj, f) }))
    .filter((s) => s.rings.length)
    .map((s) => ({ ...s, area: areaOf(s.f) }))
    .sort((a, b) => b.area - a.area);
  for (const s of states) {
    const p = s.f.properties;
    const anchor = proj([Number(p.longitude), Number(p.latitude)]) as [number, number] | null;
    if (!anchor || !insideRings(s.rings, anchor[0], anchor[1])) {
      bump("stateSkippedAnchor");
      continue;
    }
    const size = Math.min(15 * mv, Math.max(9 * mv, 0.075 * Math.sqrt(s.area))) * ls;
    const names = [String(p.name).toUpperCase()];
    if (p.postal) names.push(String(p.postal).toUpperCase());
    const res = tryPlace(names, sizeSteps(size, 7.5 * mv * ls), 0.14, false, anchor, (r, n) => {
      const pts = samples(r, n);
      return pts.filter(([x, y]) => insideRings(s.rings, x, y)).length / pts.length >= 0.85 && noDisputed(r, n);
    });
    if (!res) {
      bump("stateDropped");
      continue;
    }
    collider.add(pad(res.rect, 0.15 * res.spec.size));
    draws.push({ spec: res.spec, x: anchor[0], y: anchor[1], color: MAP_COLORS.countryLabel, alpha: 0.88, stroke: 0.03, outline: MAP_COLORS.labelOutline });
    const ll = proj.invert!(anchor)!;
    placed.push({ kind: "state", text: res.spec.lines.join(" "), owner: String(p.name), lon: ll[0], lat: ll[1], rect: [res.rect.x0, res.rect.y0, res.rect.x1, res.rect.y1] });
  }

  // 4. Cities: capitals first, then by population.
  const cities = data.places
    .filter((c) => (c.cap === 2 && c.pop >= region.capitalMinPop) || c.pop >= region.cityMinPop)
    .sort((a, b) => b.cap - a.cap || b.pop - a.pop);
  const dotR = 7 * mv;
  for (const c of cities) {
    const xy = proj([c.lon, c.lat]) as [number, number] | null;
    if (!xy || xy[0] < 0 || xy[1] < 0 || xy[0] > W || xy[1] > H) continue;
    if (inDisputed(xy[0], xy[1])) {
      bump("citySkippedDisputed");
      continue;
    }
    const dotRect = rectAt(xy[0], xy[1], dotR * 2.6, dotR * 2.6);
    if (collider.hits(dotRect)) continue;
    const size = (c.cap === 2 ? 16.5 : 14) * mv * ls;
    const cityName = c.name.replace(/\s+/g, " ");
    const spec: Spec = { lines: [CITY_NAMES[cityName] ?? cityName], size, spacing: 0.01, italic: false };
    const m = measure(spec);
    const gap = dotR * 1.5;
    const options: [number, number][] = [
      [xy[0] + gap + m.w / 2, xy[1]],
      [xy[0] - gap - m.w / 2, xy[1]],
      [xy[0], xy[1] - gap - m.h / 2],
      [xy[0], xy[1] + gap + m.h / 2],
    ];
    let done = false;
    for (const o of options) {
      const r = rectAt(o[0], o[1], m.w, m.h);
      if (!inTexture(r) || collider.hits(pad(r, 0.2 * size)) || !noDisputed(r, 1)) continue;
      // label colour follows the surface under most of the label
      const pts = samples(r, 1);
      const landShare = pts.filter(([x, y]) => onLand(x, y)).length / pts.length;
      if (landShare > 0.2 && landShare < 0.8) continue; // avoid labels straddling a coast
      collider.add(pad(r, 0.1 * size));
      collider.add(dotRect);
      draws.push({ spec, x: o[0], y: o[1], color: landShare >= 0.8 ? MAP_COLORS.cityLand : MAP_COLORS.citySea, alpha: 0.97, stroke: 0.03, outline: landShare >= 0.8 ? MAP_COLORS.labelOutline : undefined });
      dots.push({ x: xy[0], y: xy[1], onLand: onLand(xy[0], xy[1]) });
      placed.push({ kind: "city", text: spec.lines[0], owner: c.a3, lon: c.lon, lat: c.lat, rect: [r.x0, r.y0, r.x1, r.y1] });
      done = true;
      break;
    }
    bump(done ? "cityPlaced" : "cityDropped");
  }

  // ---- draw tiles -------------------------------------------------------
  // Tiles overlap by a gutter so mipmapped sampling never sees a tile edge.
  const stride = TILE_SIZE - 2 * TILE_GUTTER;
  const cols = Math.ceil(W / stride), rows = Math.ceil(H / stride);
  const tiles: MapTexture["tiles"] = [];
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const cx0 = tx * stride, cy0 = ty * stride;
      const cw = Math.min(stride, W - cx0), ch = Math.min(stride, H - cy0);
      // canvas area including the gutter
      const x = cx0 - TILE_GUTTER, y = cy0 - TILE_GUTTER;
      const w = cw + 2 * TILE_GUTTER, h = ch + 2 * TILE_GUTTER;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, -x, -y);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // sea and paper
      if (spherePath) {
        ctx.fillStyle = MAP_COLORS.offMap;
        ctx.fillRect(x, y, w, h);
        ctx.save();
        ctx.clip(spherePath);
      }
      ctx.fillStyle = MAP_COLORS.sea;
      ctx.fillRect(x, y, w, h);
      ctx.drawImage(seaMottle, 0, 0, ow * MOTTLE, oh * MOTTLE);
      // darker water hugging the coasts, lighter toward open water
      ctx.strokeStyle = MAP_COLORS.seaDark;
      for (const [width, alpha] of [[60, 0.06], [38, 0.07], [22, 0.08], [11, 0.1], [5, 0.12]]) {
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width * mv;
        ctx.stroke(coastPath);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = MAP_COLORS.graticule;
      ctx.lineWidth = 3 * mv;
      ctx.stroke(graticulePath);
      ctx.globalAlpha = 1;
      if (spherePath) ctx.restore();

      // land
      ctx.fillStyle = MAP_COLORS.land;
      ctx.fill(landPath);
      ctx.save();
      ctx.clip(landPath);
      ctx.drawImage(landMottle, 0, 0, ow * MOTTLE, oh * MOTTLE);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = MAP_COLORS.graticule;
      ctx.lineWidth = 2.6 * mv;
      ctx.stroke(graticulePath);
      ctx.globalAlpha = 1;
      ctx.restore();

      // lakes
      ctx.fillStyle = MAP_COLORS.sea;
      ctx.fill(lakePath);

      // state lines, borders
      ctx.save();
      ctx.clip(landPath);
      if (data.stateLines.length) {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = MAP_COLORS.border;
        ctx.lineWidth = 1.5 * mv;
        ctx.setLineDash([5 * mv, 2.5 * mv]);
        ctx.stroke(stateLinePath);
        ctx.setLineDash([]);
      }
      // pale inner rim along the coasts: the land looks slightly raised
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = MAP_COLORS.landRim;
      ctx.lineWidth = 10 * mv;
      ctx.stroke(coastPath);
      // embossed borders: dark shadow line, then the pale line
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = MAP_COLORS.coastInk;
      ctx.lineWidth = 2.6 * mv;
      ctx.translate(0.7 * mv, 0.7 * mv);
      ctx.stroke(solidBorders);
      ctx.translate(-0.7 * mv, -0.7 * mv);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = MAP_COLORS.border;
      ctx.lineWidth = 2.2 * mv;
      ctx.stroke(solidBorders);
      ctx.setLineDash([3.2 * mv, 2.2 * mv]);
      ctx.stroke(dashedBorders);
      ctx.setLineDash([]);
      // dark ink edge on the land side of every coast and lake shore
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = MAP_COLORS.coastInk;
      ctx.lineWidth = 2.2 * mv;
      ctx.stroke(coastPath);
      ctx.lineWidth = 1.6 * mv;
      ctx.stroke(lakePath);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 5 * mv;
      ctx.stroke(coastPath);
      ctx.globalAlpha = 1;
      ctx.restore();

      // labels
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const d of draws) {
        const m = measure(d.spec);
        if (d.x + m.w < x || d.x - m.w > x + w || d.y + m.h < y || d.y - m.h > y + h) continue;
        ctx.font = fontOf(d.spec);
        ctx.letterSpacing = `${d.spec.spacing * d.spec.size}px`;
        ctx.fillStyle = d.color;
        ctx.strokeStyle = d.color;
        ctx.globalAlpha = d.alpha;
        const n = d.spec.lines.length;
        d.spec.lines.forEach((line, i) => {
          const ly = d.y + (i - (n - 1) / 2) * d.spec.size * lineHeight + d.spec.size * 0.06;
          const lx = d.x + (d.spec.spacing * d.spec.size) / 2;
          if (d.outline) {
            // dark outline so pale labels stand off the land
            ctx.strokeStyle = d.outline;
            ctx.globalAlpha = 0.75;
            ctx.lineWidth = 0.13 * d.spec.size;
            ctx.strokeText(line, lx, ly);
            ctx.strokeStyle = d.color;
            ctx.globalAlpha = d.alpha;
          }
          if (d.stroke) {
            ctx.lineWidth = d.stroke * d.spec.size;
            ctx.strokeText(line, lx, ly);
          }
          ctx.fillText(line, lx, ly);
        });
      }
      ctx.globalAlpha = 1;
      // city dots: pale disc in a dark ring
      for (const d of dots) {
        if (d.x < x - 20 * mv || d.x > x + w + 20 * mv || d.y < y - 20 * mv || d.y > y + h + 20 * mv) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, dotR * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = MAP_COLORS.cityLand;
        ctx.fill();
        ctx.strokeStyle = MAP_COLORS.coastInk;
        ctx.lineWidth = 1.1 * mv;
        ctx.stroke();
      }
      tiles.push({ canvas, x: cx0, y: cy0, w: cw, h: ch, gutter: TILE_GUTTER });
    }
  }
  stats.buildMs = Math.round(performance.now() - t0);
  stats.width = W;
  stats.height = H;
  stats.tiles = tiles.length;
  return {
    regionId: region.id,
    width: W,
    height: H,
    tiles,
    minX: fp.minX,
    maxX: fp.maxX,
    minY: fp.minY,
    maxY: fp.maxY,
    texelsPerUnit: k,
    path: camPath,
    labels: placed,
    stats,
  };
};

export type { F };
