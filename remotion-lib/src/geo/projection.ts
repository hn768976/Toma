/**
 * projection.ts — map projection setup, without a d3 dependency.
 *
 * WHAT IT DOES
 *   Turns [longitude, latitude] into composition pixels, via a small set
 *   of projections implemented inline, behind an interface that d3-geo
 *   also satisfies.
 *
 * WHAT IT IS FOR
 *   Dot-map backdrops need exactly one thing from a projection library: a
 *   lon/lat -> x/y function. Pulling in d3-geo for that adds a dependency
 *   to every downstream project. So the library defines the *interface*
 *   (Projection) and ships two common projections; if a project needs
 *   Robinson, Winkel tripel or anything else, it passes d3-geo's
 *   projection in and everything downstream still works:
 *
 *       import { geoNaturalEarth1 } from "d3-geo";
 *       const p = geoNaturalEarth1().fitSize([1920, 1080], land);
 *       dotMapFromLand({ project: (lon, lat) => p([lon, lat]), ... });
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   Natural Earth *loading*. Fetching, caching and simplifying a
 *   shapefile or TopoJSON is project-specific — it depends on whether the
 *   data ships in public/, is bundled, or is fetched via staticFile(),
 *   and on which admin level and resolution the shot needs. A loader
 *   written against guesses about all three would be the "hardcoded
 *   assumption" case. Pass GeoJSON in; the library never does I/O.
 *
 * PARAMETERS (equirectangular / mercator)
 *   width, height   composition size in px
 *   centerLon       longitude at the horizontal centre. Default 0.
 *   scale           1 = fit the full lon range across `width`. Default 1.
 *
 * GOTCHA
 *   Mercator diverges at the poles; it is clamped to +/-85.05 degrees
 *   (the standard web-map cutoff). Antarctica is therefore unusable in
 *   mercator — use equirectangular if the shot shows the whole globe.
 *
 * USAGE
 *   const project = equirectangular({ width: 1920, height: 1080 });
 *   const [x, y] = project(-0.13, 51.5);   // London
 */

/**
 * lon/lat in degrees -> [x, y] in composition pixels, or null if the
 * coordinate does not project (off the clipped range). d3-geo projections
 * have this shape too, modulo argument packing.
 */
export type Projection = (lon: number, lat: number) => [number, number] | null;

export type ProjectionOptions = {
  width: number;
  height: number;
  centerLon?: number;
  scale?: number;
};

/** Wraps a longitude into [-180, 180) relative to `centerLon`. */
const wrapLon = (lon: number, centerLon: number): number => {
  let d = lon - centerLon;
  while (d < -180) d += 360;
  while (d >= 180) d -= 360;
  return d;
};

/**
 * Plate carree. Linear in both axes, so it is the cheapest to invert and
 * the safest for whole-globe shots. Latitude is squashed at the poles
 * relative to reality, which for a stylised dot map is rarely noticeable.
 */
export const equirectangular = ({
  width,
  height,
  centerLon = 0,
  scale = 1,
}: ProjectionOptions): Projection => {
  return (lon, lat) => {
    const d = wrapLon(lon, centerLon);
    const x = width / 2 + (d / 360) * width * scale;
    const y = height / 2 - (lat / 180) * height * scale;
    return [x, y];
  };
};

/** The web-map standard cutoff, where mercator y would run to infinity. */
export const MERCATOR_MAX_LAT = 85.05112878;

/**
 * Web mercator. Preserves local angles, so coastlines keep their familiar
 * shape, at the cost of wildly exaggerated high latitudes.
 */
export const mercator = ({
  width,
  height,
  centerLon = 0,
  scale = 1,
}: ProjectionOptions): Projection => {
  const maxY = Math.log(
    Math.tan(Math.PI / 4 + (MERCATOR_MAX_LAT * Math.PI) / 360),
  );
  return (lon, lat) => {
    if (lat > MERCATOR_MAX_LAT || lat < -MERCATOR_MAX_LAT) return null;
    const d = wrapLon(lon, centerLon);
    const x = width / 2 + (d / 360) * width * scale;
    const yRaw = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const y = height / 2 - (yRaw / maxY) * (height / 2) * scale;
    return [x, y];
  };
};
