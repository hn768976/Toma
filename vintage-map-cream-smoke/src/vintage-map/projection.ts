import { geoConicConformal, geoNaturalEarth1, type GeoProjection } from "d3-geo";
import type { MapRegion } from "./regions";

// Base scale for "plane units": the 3D map plane uses projected coordinates at
// this scale (x right, y up).
export const BASE_SCALE = 1000;

export const makeProjection = (region: MapRegion): GeoProjection => {
  const spec = region.projection;
  const p = spec.type === "conicConformal" ? geoConicConformal().parallels(spec.parallels) : geoNaturalEarth1();
  return p.rotate(spec.rotate).center(spec.center).scale(BASE_SCALE).translate([0, 0]).precision(0.2);
};

// lon/lat -> plane units (y up).
export const toPlane = (proj: GeoProjection, lonlat: [number, number]): [number, number] => {
  const xy = proj(lonlat);
  if (!xy) throw new Error(`Cannot project ${lonlat}`);
  return [xy[0], -xy[1]];
};
