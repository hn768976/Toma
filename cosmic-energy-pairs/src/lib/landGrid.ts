/**
 * Natural Earth 1:110m land → grid of cells (equirectangular), Antarctica cut.
 * Pure function of the shipped GeoJSON: same data in, same cells out.
 */

export const GRID_COLS = 200;
export const LAT_TOP = 83.7;
export const LAT_BOTTOM = -56.0; // everything south (Antarctica) is left out
export const CELL_DEG = 360 / GRID_COLS;
export const GRID_ROWS = Math.round((LAT_TOP - LAT_BOTTOM) / CELL_DEG);

export type LandCell = { col: number; row: number; lon: number; lat: number };

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rasterizeLand = (geojson: any): LandCell[] => {
  const polys: Poly[] = [];
  for (const f of geojson.features) {
    const g = f.geometry;
    const list: Ring[][] = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const rings of list) {
      let minX = 999, maxX = -999, minY = 999, maxY = -999;
      for (const [x, y] of rings[0]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (maxY < LAT_BOTTOM) continue; // Antarctica
      polys.push({ rings, minX, maxX, minY, maxY });
    }
  }
  const cells: LandCell[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      // 2×2 sub-samples; a cell is land when at least 2 of 4 hit.
      let hits = 0;
      const lon = -180 + (col + 0.5) * CELL_DEG;
      const lat = LAT_TOP - (row + 0.5) * CELL_DEG;
      for (const [ox, oy] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
        const x = lon + ox * CELL_DEG;
        const y = lat + oy * CELL_DEG;
        for (const p of polys) {
          if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) continue;
          let inside = inRing(x, y, p.rings[0]);
          for (let h = 1; h < p.rings.length && inside; h++) if (inRing(x, y, p.rings[h])) inside = false;
          if (inside) {
            hits++;
            break;
          }
        }
      }
      if (hits >= 2 && lat > LAT_BOTTOM) cells.push({ col, row, lon, lat });
    }
  }
  return cells;
};
