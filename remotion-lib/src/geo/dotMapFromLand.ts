/**
 * dotMapFromLand.ts — sample a grid against land polygons to make a dot map.
 *
 * WHAT IT DOES
 *   Walks a regular lon/lat grid, keeps the points that fall inside a land
 *   polygon, projects them to pixels, and flags the ones adjacent to
 *   water so the caller can brighten coastlines.
 *
 * WHAT IT IS FOR
 *   The dot-matrix world map: a field of even dots forming continents,
 *   usually with the coast picked out brighter than the interior. Doing
 *   this by hand means a point-in-polygon test per grid cell against a
 *   multipolygon with tens of thousands of rings, which is slow enough to
 *   matter if it happens per frame. This runs once, off the frame clock,
 *   and returns a plain array the render loop can walk.
 *
 * WHY THE COASTAL FLAG IS COMPUTED HERE
 *   Adjacency is cheap while the occupancy grid still exists and
 *   expensive afterwards: once you hold only a list of kept dots, working
 *   out which had an empty neighbour means a spatial query per dot.
 *   Computing it during the sweep costs one extra pass over a boolean
 *   grid. A dot is coastal when any of its 4-neighbours is not land, so
 *   the flag also marks lake shores and the edges of the sampled region.
 *
 * PARAMETERS
 *   land          GeoJSON Polygon / MultiPolygon / Feature /
 *                 FeatureCollection in lon-lat degrees. Not loaded by
 *                 this library — see projection.ts for why.
 *   project       lon/lat -> pixels. From projection.ts, or d3-geo.
 *   stepDeg       grid spacing in degrees. Default 1.2 — about 150 dots
 *                 across at the equator, which is the density where the
 *                 continents read at 1080p. Halving it quadruples cost.
 *   lonRange      [min, max] degrees to sweep. Default [-180, 180].
 *   latRange      [min, max] degrees. Default [-56, 84]: drops Antarctica
 *                 and the empty far north, which is what almost every
 *                 map shot wants. Widen for a polar composition.
 *   jitter        0..1, fraction of a grid step to randomly displace each
 *                 dot by. Default 0 (a true grid). Small values (~0.25)
 *                 break the moire that a regular grid produces against a
 *                 curved coastline; above ~0.5 the map stops reading as
 *                 a matrix.
 *   seed          integer, only used when jitter > 0. Default 1.
 *
 * RETURNS
 *   LandDot[] with pixel x/y, source lon/lat, and `coastal`.
 *
 * PERFORMANCE / GOTCHA
 *   This is O(gridCells * polygonEdges) and is NOT cheap: a 1.2-degree
 *   grid against full-resolution Natural Earth land is on the order of
 *   35k cells against ~200k edges. Call it ONCE, in a useMemo keyed on
 *   the inputs — never inside a per-frame loop. If it still feels slow,
 *   simplify the polygons before passing them in (mapshaper, or
 *   topojson-simplify); dot maps do not need 10m resolution.
 *
 * USAGE
 *   const project = equirectangular({ width: 1920, height: 1080 });
 *   const dots = useMemo(
 *     () => dotMapFromLand({ land, project, stepDeg: 1.2 }),
 *     [land, project],
 *   );
 *   dots.map((d) => (
 *     <circle cx={d.x} cy={d.y} r={1.5}
 *             fill={d.coastal ? coastColor : landColor} />
 *   ));
 */

import { seededRandom } from "../random/seededRandom";
import type { Projection } from "./projection";

/** A [lon, lat] pair, as GeoJSON stores it. */
type Position = [number, number];
/** A polygon: an outer ring followed by any number of hole rings. */
type PolygonRings = Position[][];

type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: PolygonRings }
  | { type: "MultiPolygon"; coordinates: PolygonRings[] };

type GeoJsonFeature = { type: "Feature"; geometry: GeoJsonGeometry | null };

export type LandGeoJson =
  | GeoJsonGeometry
  | GeoJsonFeature
  | { type: "FeatureCollection"; features: GeoJsonFeature[] };

export type LandDot = {
  /** Pixel position from `project`. */
  x: number;
  y: number;
  /** Source coordinate, kept for re-projection without re-sampling. */
  lon: number;
  lat: number;
  /** True when at least one 4-neighbour cell was not land. */
  coastal: boolean;
};

export type DotMapOptions = {
  land: LandGeoJson;
  project: Projection;
  stepDeg?: number;
  lonRange?: [number, number];
  latRange?: [number, number];
  jitter?: number;
  seed?: number;
};

/** Flattens any accepted GeoJSON shape down to a list of polygons. */
const collectPolygons = (land: LandGeoJson): PolygonRings[] => {
  if (land.type === "FeatureCollection") {
    return land.features.flatMap((f) =>
      f.geometry ? collectPolygons(f.geometry) : [],
    );
  }
  if (land.type === "Feature") {
    return land.geometry ? collectPolygons(land.geometry) : [];
  }
  if (land.type === "Polygon") return [land.coordinates];
  if (land.type === "MultiPolygon") return land.coordinates;
  return [];
};

/**
 * Ray-casting point-in-ring test. Counts crossings of a ray cast in +lon
 * from the point; odd means inside.
 */
const pointInRing = (lon: number, lat: number, ring: Position[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // Does the edge straddle our latitude, and is the crossing to our east?
    const straddles = yi > lat !== yj > lat;
    if (straddles && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

/** Inside the outer ring and outside every hole. */
const pointInPolygon = (
  lon: number,
  lat: number,
  rings: PolygonRings,
): boolean => {
  if (rings.length === 0) return false;
  if (!pointInRing(lon, lat, rings[0])) return false;
  for (let h = 1; h < rings.length; h++) {
    if (pointInRing(lon, lat, rings[h])) return false;
  }
  return true;
};

/** Axis-aligned bounds of a polygon, for a cheap early reject. */
const ringBounds = (rings: PolygonRings) => {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of rings[0] ?? []) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
};

export const dotMapFromLand = ({
  land,
  project,
  stepDeg = 1.2,
  lonRange = [-180, 180],
  latRange = [-56, 84],
  jitter = 0,
  seed = 1,
}: DotMapOptions): LandDot[] => {
  const polygons = collectPolygons(land).filter((p) => p.length > 0);
  const bounds = polygons.map(ringBounds);

  const cols = Math.max(1, Math.ceil((lonRange[1] - lonRange[0]) / stepDeg));
  const rows = Math.max(1, Math.ceil((latRange[1] - latRange[0]) / stepDeg));

  // Pass 1: occupancy. Kept as a flat boolean grid so pass 2 can ask
  // about neighbours in O(1).
  const occupied = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    const lat = latRange[0] + row * stepDeg;
    for (let col = 0; col < cols; col++) {
      const lon = lonRange[0] + col * stepDeg;
      let isLand = false;
      for (let p = 0; p < polygons.length; p++) {
        const b = bounds[p];
        if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) {
          continue;
        }
        if (pointInPolygon(lon, lat, polygons[p])) {
          isLand = true;
          break;
        }
      }
      if (isLand) occupied[row * cols + col] = 1;
    }
  }

  const isLandAt = (col: number, row: number): boolean => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
    return occupied[row * cols + col] === 1;
  };

  // Pass 2: project the kept cells and flag coastal ones.
  const dots: LandDot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isLandAt(col, row)) continue;

      const index = row * cols + col;
      let lon = lonRange[0] + col * stepDeg;
      let lat = latRange[0] + row * stepDeg;
      if (jitter > 0) {
        lon += (seededRandom(index, seed + 1) - 0.5) * stepDeg * jitter;
        lat += (seededRandom(index, seed + 40) - 0.5) * stepDeg * jitter;
      }

      const projected = project(lon, lat);
      if (!projected) continue;

      dots.push({
        x: projected[0],
        y: projected[1],
        lon,
        lat,
        coastal:
          !isLandAt(col - 1, row) ||
          !isLandAt(col + 1, row) ||
          !isLandAt(col, row - 1) ||
          !isLandAt(col, row + 1),
      });
    }
  }
  return dots;
};
