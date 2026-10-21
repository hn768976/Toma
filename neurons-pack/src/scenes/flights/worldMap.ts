// Natural Earth 110m land (public domain), via the world-atlas TopoJSON
// build. Land only, no borders; Antarctica is left out so the map reads
// like the flat route maps it is meant for.
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";

export const MAP = {
  lonMin: -172,
  lonSpan: 352,
  /** y = H * (top + (latTop - lat) / latSpan * span) */
  latTop: 83.5,
  latSpan: 139.5,
  top: 0.105,
  span: 0.74,
};

export const project = (lon: number, lat: number, W: number, H: number): [number, number] => [
  ((lon - MAP.lonMin) / MAP.lonSpan) * W,
  H * (MAP.top + ((MAP.latTop - lat) / MAP.latSpan) * MAP.span),
];

type Ring = [number, number][];

/** Land polygons as [outer, ...holes] rings in lon/lat. */
export const landPolygons = (): Ring[][] => {
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const fc = feature(topo, topo.objects.land) as unknown as GeoJSON.FeatureCollection;
  const out: Ring[][] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
    for (const poly of polys) {
      const outer = poly[0] as Ring;
      if (Math.max(...outer.map((p) => p[1])) < -58) continue; // Antarctica
      out.push(poly as Ring[]);
    }
  }
  return out;
};

const inRing = (lon: number, lat: number, ring: Ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const isLand = (lon: number, lat: number, polys: Ring[][]) =>
  polys.some((p) => inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h)));
