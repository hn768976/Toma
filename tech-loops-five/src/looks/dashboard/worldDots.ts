import land from "../../data/ne_110m_land.json";

/**
 * Dotted world map from Natural Earth 1:110m land polygons (public domain).
 * Built once at module level: a lon/lat grid is tested against the polygons
 * (even-odd ray casting). Output coordinates are normalised 0..1
 * (equirectangular, lat 84°N → 58°S).
 */
type Ring = [number, number][];
type Geo = {
  features: { geometry: { type: string; coordinates: unknown } }[];
};

const polys: Ring[][] = [];
for (const f of (land as unknown as Geo).features) {
  if (f.geometry.type === "Polygon") polys.push(f.geometry.coordinates as Ring[]);
  else if (f.geometry.type === "MultiPolygon") for (const p of f.geometry.coordinates as Ring[][]) polys.push(p);
}

const inRing = (x: number, y: number, ring: Ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const isLand = (lon: number, lat: number) => {
  for (const p of polys) {
    if (inRing(lon, lat, p[0])) {
      let hole = false;
      for (let h = 1; h < p.length; h++) if (inRing(lon, lat, p[h])) hole = true;
      if (!hole) return true;
    }
  }
  return false;
};

export const LAT_TOP = 84;
export const LAT_BOTTOM = -58;
const STEP = 2.0;

export const WORLD_DOTS: [number, number][] = [];
for (let lat = LAT_TOP - STEP / 2; lat > LAT_BOTTOM; lat -= STEP) {
  for (let lon = -180 + STEP / 2; lon < 180; lon += STEP) {
    if (isLand(lon, lat)) {
      WORLD_DOTS.push([(lon + 180) / 360, (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)]);
    }
  }
}

/** lon/lat → normalised map coordinates */
export const project = (lon: number, lat: number): [number, number] => [
  (lon + 180) / 360,
  (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM),
];
