import { geoEquirectangular, geoGraticule, geoPath } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { continueRender, delayRender, staticFile } from "remotion";
import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Rect } from "../layout";

export type CountryFeature = Feature<Geometry, { name: string }>;

/**
 * Natural Earth 110m country polygons (public domain), shipped in
 * public/geo/countries-110m.json. Loaded once per page - the promise is
 * memoised at module scope so every composition shares one parse.
 */
let worldPromise: Promise<CountryFeature[]> | null = null;

export const loadWorld = (): Promise<CountryFeature[]> => {
  if (worldPromise) return worldPromise;
  worldPromise = fetch(staticFile("geo/countries-110m.json"))
    .then((res) => res.json())
    .then((topology: Topology) => {
      const collection = feature(
        topology,
        topology.objects.countries as GeometryCollection<{ name: string }>,
      ) as FeatureCollection<Geometry, { name: string }>;
      // Antarctica is omitted - it dominates an equirectangular frame and
      // carries no useful signal for this dashboard.
      return collection.features.filter(
        (f) => f.properties?.name !== "Antarctica",
      ) as CountryFeature[];
    });
  return worldPromise;
};

/** Loads the country polygons, holding the render open until they arrive. */
export const useWorld = (): CountryFeature[] | null => {
  const [world, setWorld] = useState<CountryFeature[] | null>(null);
  useEffect(() => {
    const handle = delayRender("Loading Natural Earth 110m countries");
    let cancelled = false;
    loadWorld()
      .then((features) => {
        if (!cancelled) setWorld(features);
        continueRender(handle);
      })
      .catch((err) => {
        continueRender(handle);
        throw err;
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return world;
};

export type ProjectedCountry = {
  name: string;
  path: Path2D;
  /** Projected centroid, used for markers and connector lines. */
  cx: number;
  cy: number;
  /** Projected bounding-box area - used to rank which countries are big
   *  enough to read as a highlight. */
  area: number;
};

export type ProjectedMap = {
  countries: ProjectedCountry[];
  graticule: Path2D;
  /** Lon/lat -> canvas pixels, for placing fixed markers. */
  project: (lonLat: [number, number]) => [number, number] | null;
  /** Indices into `countries`, largest first - the highlight pool. */
  highlightPool: number[];
};

/**
 * Projects the world once for a given rectangle. This is the single most
 * expensive operation in the project; it must never run per frame.
 */
export const projectWorld = (
  world: CountryFeature[],
  rect: Rect,
): ProjectedMap => {
  const collection: FeatureCollection<Geometry, { name: string }> = {
    type: "FeatureCollection",
    features: world,
  };

  const projection = geoEquirectangular().fitExtent(
    [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y + rect.h],
    ],
    collection as unknown as GeoPermissibleObjects,
  );

  const path = geoPath(projection);

  const countries: ProjectedCountry[] = world.map((f) => {
    const d = path(f as unknown as GeoPermissibleObjects) ?? "";
    const [[x0, y0], [x1, y1]] = path.bounds(
      f as unknown as GeoPermissibleObjects,
    );
    const centroid = path.centroid(f as unknown as GeoPermissibleObjects);
    return {
      name: f.properties?.name ?? "UNKNOWN",
      path: new Path2D(d),
      cx: Number.isFinite(centroid[0]) ? centroid[0] : (x0 + x1) / 2,
      cy: Number.isFinite(centroid[1]) ? centroid[1] : (y0 + y1) / 2,
      area: Math.max(0, (x1 - x0) * (y1 - y0)),
    };
  });

  const graticulePath = geoPath(projection)(
    geoGraticule().step([15, 15])() as unknown as GeoPermissibleObjects,
  );

  // Rank by projected size, then by name so the order is stable regardless of
  // the source file's ordering.
  const highlightPool = countries
    .map((c, i) => ({ i, area: c.area, name: c.name }))
    .sort((a, b) => b.area - a.area || (a.name < b.name ? -1 : 1))
    .slice(0, 56)
    .map((c) => c.i);

  return {
    countries,
    graticule: new Path2D(graticulePath ?? ""),
    project: (lonLat) => {
      const out = projection(lonLat);
      return out ? [out[0], out[1]] : null;
    },
    highlightPool,
  };
};
