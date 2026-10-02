import * as THREE from "three";
import { loadJSON } from "../../lib/assets";

// Natural Earth 1:50m Admin 0 countries (public domain), default worldview.
export const NE_PATH = "naturalearth/ne_50m_admin_0_countries.geojson";

type Ring = [number, number][];
type Feature = {
  properties: { ADM0_A3: string; NAME: string };
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
};
type FC = { features: Feature[] };

let cache: Promise<FC> | null = null;
const loadNE = () => (cache ??= loadJSON<FC>(NE_PATH));

const ringArea = (r: Ring) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
};

/**
 * Main landmass of a country (largest polygon: the contiguous US for "USA",
 * mainland China for "CHN"), projected equirectangularly around its centre
 * with cos(lat) scaling, scaled to `width` world units. Returns THREE.Shapes
 * in (x = east, y = north) plus the bounding box.
 */
export async function countryShape(iso: string, width: number): Promise<{ shapes: THREE.Shape[]; w: number; h: number }> {
  const fc = await loadNE();
  const f = fc.features.find((x) => x.properties.ADM0_A3 === iso);
  if (!f) throw new Error(`Natural Earth: no country with ADM0_A3=${iso}`);
  const polys: Ring[][] = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const main = polys.reduce((best, p) => (ringArea(p[0]) > ringArea(best[0]) ? p : best));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  main[0].forEach(([lon, lat]) => {
    minX = Math.min(minX, lon); maxX = Math.max(maxX, lon);
    minY = Math.min(minY, lat); maxY = Math.max(maxY, lat);
  });
  const lat0 = (minY + maxY) / 2, lon0 = (minX + maxX) / 2;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const pw = (maxX - minX) * k;
  const s = width / pw;
  const proj = (lon: number, lat: number) => new THREE.Vector2((lon - lon0) * k * s, (lat - lat0) * s);
  const toPts = (r: Ring) => {
    const out: THREE.Vector2[] = [];
    r.forEach(([lon, lat]) => {
      const p = proj(lon, lat);
      if (!out.length || out[out.length - 1].distanceTo(p) > width * 0.0015) out.push(p);
    });
    if (out.length > 2 && out[0].distanceTo(out[out.length - 1]) < 1e-6) out.pop();
    return out;
  };
  const shape = new THREE.Shape(toPts(main[0]));
  main.slice(1).forEach((hole) => shape.holes.push(new THREE.Path(toPts(hole))));
  return { shapes: [shape], w: width, h: (maxY - minY) * s };
}
