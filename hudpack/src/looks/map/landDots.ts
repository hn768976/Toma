import { staticFile } from "remotion";
import { mulberry32 } from "../../lib/random";

// Natural Earth 1:110m land (public domain; see public/data/NATURAL_EARTH.md)
// rasterised to a 1-degree dot grid by scanline fill. Pure arithmetic on the
// polygon vertices, so the dot set is identical on every machine.

export const LAT_MIN = -56;
export const LAT_MAX = 82;
export const STEP = 1;

export interface Dot {
  lon: number;
  lat: number;
  bright: number;
  /** Twinkle period in frames (divides 600), 0 for none. */
  period: number;
  phase: number;
  /** Dots of the vertical data columns rising out of the land. */
  column: boolean;
}

type Ring = [number, number][];

const rasterise = (rings: Ring[]) => {
  const cols = 360 / STEP;
  const rows = (LAT_MAX - LAT_MIN) / STEP;
  const land = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const lat = LAT_MIN + (r + 0.5) * STEP;
    const xs: number[] = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        if (y1 <= lat !== y2 <= lat) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let c = 0; c < cols; c++) {
        const lon = -180 + (c + 0.5) * STEP;
        if (lon >= xs[i] && lon < xs[i + 1]) land[r * cols + c] = 1;
      }
    }
  }
  return { land, cols, rows };
};

const PERIODS = [30, 40, 50, 60, 75, 100, 120, 150, 200, 300, 600];

const buildDots = (rings: Ring[]): Dot[] => {
  const { land, cols, rows } = rasterise(rings);
  const rng = mulberry32(0x3a9d07);
  const at = (c: number, r: number) => (r < 0 || r >= rows ? 0 : land[r * cols + ((c + cols) % cols)]);
  const dots: Dot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(c, r)) continue;
      let n = 0;
      for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) n += at(c + dc, r + dr);
      const density = n / 49;
      const tw = rng() < 0.12;
      dots.push({
        lon: -180 + (c + 0.5) * STEP,
        lat: LAT_MIN + (r + 0.5) * STEP,
        bright: (0.25 + 0.75 * Math.pow(density, 1.6)) * (0.65 + 0.35 * rng()),
        period: tw ? PERIODS[Math.floor(rng() * PERIODS.length)] : 0,
        phase: rng(),
        column: false,
      });
      // vertical data columns rising above some dense land cells
      if (density > 0.45 && rng() < 0.11) {
        const h = 3 + Math.floor(rng() * rng() * 34);
        for (let k = 1; k <= h; k++) {
          dots.push({
            lon: -180 + (c + 0.5) * STEP,
            lat: LAT_MIN + (r + 0.5 + k) * STEP,
            bright: 1.0 * (1 - (0.7 * k) / (h + 1)) * (0.6 + 0.4 * rng()),
            period: rng() < 0.3 ? PERIODS[Math.floor(rng() * PERIODS.length)] : 0,
            phase: rng(),
            column: true,
          });
        }
      }
    }
  }
  // free-floating dot columns over sea and sky ("data rain")
  for (let i = 0; i < 170; i++) {
    const c = Math.floor(rng() * cols);
    const r0 = Math.floor(rng() * rows);
    const h = 4 + Math.floor(rng() * rng() * 40);
    for (let k = 0; k < h; k++) {
      dots.push({
        lon: -180 + (c + 0.5) * STEP,
        lat: LAT_MIN + (r0 + 0.5 + k) * STEP,
        bright: 0.55 * (1 - (0.8 * k) / h) * (0.5 + 0.5 * rng()),
        period: rng() < 0.4 ? PERIODS[Math.floor(rng() * PERIODS.length)] : 0,
        phase: rng(),
        column: true,
      });
    }
  }
  return dots;
};

let promise: Promise<Dot[]> | null = null;

export const loadLandDots = () => {
  if (!promise) {
    promise = fetch(staticFile("data/ne_110m_land.geojson"))
      .then((r) => r.json())
      .then((geo: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
        const rings: Ring[] = [];
        for (const f of geo.features) {
          const g = f.geometry;
          const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
          for (const p of polys) for (const ring of p) rings.push(ring);
        }
        return buildDots(rings);
      });
  }
  return promise;
};
