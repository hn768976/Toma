/**
 * Data model for the Route Map project.
 *
 * Everything a region needs lives in `src/data/regions.ts`. Adding a further
 * region is a data entry plus one bake command — no component changes.
 */

export type Palette = "warm" | "cool";

/** Default marker species for a region. `mixed` uses both. */
export type RouteType = "air" | "shipping" | "mixed";

export type LineStyle = "solid" | "dashed" | "dotted";

export type RouteColor = "cyan" | "white" | "green";

export type PinColor = "red" | "yellow" | "blue" | "green" | "orange";

/** [lon, lat] in degrees. */
export type LonLat = [number, number];

export interface RouteDef {
  /** Stable id — also seeds this route's marker phases. */
  id: string;
  style: LineStyle;
  color: RouteColor;
  /**
   * Waypoints in lon/lat. Two points are drawn as a bowed arc (see `bend`);
   * three or more are smoothed through with a Catmull-Rom spline, which is how
   * shipping lanes are kept in the water.
   */
  pts: LonLat[];
  /** Perpendicular bow as a fraction of the chord, for two-point arcs. */
  bend?: number;
  /** Overrides the region's marker species for this route. */
  mode?: "air" | "sea";
  /** How many markers ride this route at once. 0 leaves it empty. */
  markers?: number;
  /** Whole trips each marker completes over the 480-frame loop. */
  trips?: number;
  /** Stroke weight multiplier. */
  weight?: number;
  /** Draw a small circular endpoint dot at the first/last waypoint. */
  endDots?: [boolean, boolean];
}

export interface PinDef {
  lon: number;
  lat: number;
  color: PinColor;
  /** Emits a slow expanding ring. Keep to one or two per region. */
  pulse?: boolean;
}

export interface RegionDef {
  /** Used for the baked basemap filename. */
  id: string;
  name: string;
  /** Centre of the framing, [lon, lat]. */
  center: LonLat;
  /** Degrees of latitude spanned by the frame height at the plane centre. */
  span: number;
  /**
   * Standard parallel for the equidistant-cylindrical projection. Defaults to
   * the centre latitude, which keeps continental shapes from looking
   * horizontally stretched. Use 0 for a true plate-carree world view.
   */
  stdParallel?: number;
  palette: Palette;
  routeType: RouteType;
  /** Minor graticule spacing, degrees. */
  gridStep: number;
  /** A major graticule line every N minor lines. */
  gridMajor: number;
  /** Base value for the left / right numeric edge readouts. */
  edgeScale: [number, number];
  /** Boxes of open water, [lonMin, latMin, lonMax, latMax], for scattered decor. */
  waterBoxes: [number, number, number, number][];
  routes: RouteDef[];
  pins: PinDef[];
}

export type RouteMapProps = {
  regionId: string;
  /** Overrides the region's default palette. */
  palette?: Palette;
  /** Overrides the region's default route type. */
  routeType?: RouteType;
  /** Overrides the total number of moving markers (15-30 reads best). */
  markers?: number;
};
