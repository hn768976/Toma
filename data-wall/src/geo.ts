import { geoEquirectangular, geoPath } from "d3-geo";
import { merge } from "topojson-client";
import type {
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Topology,
} from "topojson-specification";
import topology from "../public/countries-110m.json";

/**
 * Natural Earth 1:110m "Admin 0 – countries", as redistributed by the
 * world-atlas project. Natural Earth is public domain.
 *
 * Antarctica is dropped: it is a huge white band across the bottom of an
 * equirectangular projection and would read as a subject rather than texture.
 */
const ANTARCTICA_ID = "010";

const topo = topology as unknown as Topology<{
  countries: GeometryCollection<{ name: string }>;
}>;

/**
 * One filled MultiPolygon of all land, with internal country borders removed.
 *
 * The projection is fitted so that a full 360° of longitude is exactly
 * `tileW` wide. That makes the map repeat seamlessly at the same period as the
 * number grid and the price series, so all three drift together and the loop
 * closes on the same frame.
 */
export const buildLandPath = (tileW: number): Path2D => {
  const geometries = topo.objects.countries.geometries.filter(
    (g) => String(g.id) !== ANTARCTICA_ID,
  ) as (Polygon | MultiPolygon)[];
  const land = merge(topo, geometries);

  const projection = geoEquirectangular()
    .scale(tileW / (Math.PI * 2))
    .translate([tileW / 2, 0]);

  const d = geoPath(projection)(land) ?? "";
  return new Path2D(d);
};
