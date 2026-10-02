// Natural Earth 1:50m land (public domain) rasterised to a dot grid.
// Computed once per page at module level (memoised promise) and handed to the
// component behind delayRender. Antarctica is excluded by the latitude range.
import { staticFile } from "remotion";

export const COLS = 180; // dots across
export const CELL_DEG = 360 / COLS; // 2°
export const LAT_TOP = 84;
export const LAT_BOTTOM = -58; // stops above Antarctica
export const ROWS = Math.round((LAT_TOP - LAT_BOTTOM) / CELL_DEG); // 71

export type LandDots = { col: number; row: number }[];

type Ring = number[][];
type Poly = { rings: Ring[]; minX: number; maxX: number; minY: number; maxY: number };

const inRing = (x: number, y: number, ring: Ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const isLand = (lon: number, lat: number, polys: Poly[]) => {
  for (const p of polys) {
    if (lon < p.minX || lon > p.maxX || lat < p.minY || lat > p.maxY) continue;
    let inside = false;
    for (const ring of p.rings) if (inRing(lon, lat, ring)) inside = !inside; // holes flip
    if (inside) return true;
  }
  return false;
};

const rasterise = (geo: { features: { geometry: { type: string; coordinates: unknown } }[] }): LandDots => {
  const polys: Poly[] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    const list = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
    for (const rings of list) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of rings[0]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (maxY < -60) continue; // Antarctica
      polys.push({ rings, minX, maxX, minY, maxY });
    }
  }
  // 3x3 supersampling per cell; a cell is land when ≥3 of 9 samples are.
  const dots: LandDots = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      let hits = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const lon = -180 + (col + (sx + 0.5) / 3) * CELL_DEG;
          const lat = LAT_TOP - (row + (sy + 0.5) / 3) * CELL_DEG;
          if (isLand(lon, lat, polys)) hits++;
        }
      }
      if (hits >= 3) dots.push({ col, row });
    }
  }
  return dots;
};

let cache: Promise<LandDots> | null = null;
export const loadLandDots = () => {
  if (!cache) {
    cache = fetch(staticFile("data/ne_50m_land.geojson"))
      .then((r) => r.json())
      .then(rasterise);
  }
  return cache;
};
