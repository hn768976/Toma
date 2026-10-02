import { continueRender, delayRender, staticFile } from "remotion";

// Dotted world map from Natural Earth 1:110m land (public domain, shipped in
// public/data). Loaded once behind delayRender; dots are a fixed lon/lat grid
// filtered by point-in-polygon.

type Ring = [number, number][];
export type Dot = { lon: number; lat: number };

let cache: Promise<Dot[]> | null = null;

const inRing = (lon: number, lat: number, ring: Ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const loadWorldDots = (step = 3): Promise<Dot[]> => {
  if (cache) return cache;
  const h = delayRender("Loading Natural Earth land");
  cache = fetch(staticFile("data/ne_110m_land.geojson"))
    .then((r) => r.json())
    .then((gj: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
      const polys: Ring[][] = [];
      for (const f of gj.features) {
        const g = f.geometry;
        if (g.type === "Polygon") polys.push(g.coordinates as Ring[]);
        else if (g.type === "MultiPolygon") for (const p of g.coordinates as Ring[][]) polys.push(p);
      }
      const dots: Dot[] = [];
      for (let lat = 80; lat >= -58; lat -= step)
        for (let lon = -180 + step / 2; lon < 180; lon += step) {
          for (const p of polys) {
            if (inRing(lon, lat, p[0]) && !p.slice(1).some((hole) => inRing(lon, lat, hole))) {
              dots.push({ lon, lat });
              break;
            }
          }
        }
      continueRender(h);
      return dots;
    });
  return cache;
};
