import { staticFile } from "remotion";

// Natural Earth 1:110m land (public domain) rasterised into a coarse dot grid
// by exact point-in-polygon tests — pure math, identical on every thread.

export type LandMask = { cols: number; rows: number; latMin: number; latMax: number; data: Uint8Array };

type Ring = number[][];
type Poly = { rings: Ring[]; bbox: [number, number, number, number] };

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

export const buildLandMask = (geo: { features: { geometry: { type: string; coordinates: unknown } }[] }, cols: number, rows: number, latMin: number, latMax: number): LandMask => {
  const polys: Poly[] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    const list = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
    for (const rings of list) {
      let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
      for (const [x, y] of rings[0]) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      polys.push({ rings, bbox: [x0, y0, x1, y1] });
    }
  }
  const data = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const lat = latMin + ((r + 0.5) / rows) * (latMax - latMin);
    for (let c = 0; c < cols; c++) {
      const lon = -180 + ((c + 0.5) / cols) * 360;
      let land = false;
      for (const p of polys) {
        if (lon < p.bbox[0] || lon > p.bbox[2] || lat < p.bbox[1] || lat > p.bbox[3]) continue;
        if (inRing(lon, lat, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(lon, lat, h))) {
          land = true;
          break;
        }
      }
      data[r * cols + c] = land ? 255 : 0;
    }
  }
  return { cols, rows, latMin, latMax, data };
};

export const loadLandMask = async (): Promise<LandMask> => {
  const res = await fetch(staticFile("data/ne_110m_land.geojson"));
  const geo = await res.json();
  return buildLandMask(geo, 170, 70, -58, 84);
};
