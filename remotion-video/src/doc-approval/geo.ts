import { geoEquirectangular, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import type { MultiPolygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import landTopo from "../../public/geo/ne_110m_land.topo.json";
import { MAP_CENTER_Y, MAP_WORLD_WIDTH, WIDTH } from "./layout";

/**
 * Natural Earth 110m land polygons (public domain), shipped in `public/geo/`
 * and bundled at build time so rendering never waits on a network fetch.
 */
const topology = landTopo as Topology<{ land: GeometryCollection }>;

/**
 * Antarctica dominates an equirectangular projection and adds nothing here,
 * so any polygon that never reaches above 60 degrees south is dropped.
 */
const withoutAntarctica = (geometry: MultiPolygon): MultiPolygon => ({
  type: "MultiPolygon",
  coordinates: geometry.coordinates.filter((polygon) => {
    let maxLatitude = -90;
    for (const [, latitude] of polygon[0]) {
      if (latitude > maxLatitude) maxLatitude = latitude;
    }
    return maxLatitude > -60;
  }),
});

export type LandProjection = {
  land: MultiPolygon;
  projection: GeoProjection;
};

/**
 * Builds the land geometry and the projection fitted to the frame. Called
 * once from a useMemo - re-projecting per frame is the expensive mistake in
 * a piece like this.
 */
export const buildLandProjection = (): LandProjection => {
  const collection = feature(topology, topology.objects.land);
  const merged: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: collection.features.flatMap((f) =>
      f.geometry.type === "MultiPolygon"
        ? f.geometry.coordinates
        : f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : [],
    ),
  };
  const land = withoutAntarctica(merged);

  // Equirectangular's raw x spans 2*PI radians across the full globe, so the
  // scale that makes the world MAP_WORLD_WIDTH wide is width / (2*PI).
  const scale = MAP_WORLD_WIDTH / (2 * Math.PI);
  const probe = geoEquirectangular().scale(scale).translate([WIDTH / 2, 0]);
  const bounds = geoPath(probe).bounds(land);
  const translateY = MAP_CENTER_Y - (bounds[0][1] + bounds[1][1]) / 2;

  return {
    land,
    projection: geoEquirectangular()
      .scale(scale)
      .translate([WIDTH / 2, translateY]),
  };
};
