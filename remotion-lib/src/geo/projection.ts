/**
 * projection — Natural Earth loading and d3-geo projection setup.
 *
 * WHAT: Wraps the two things every map project in the survey did identically:
 * fit an equirectangular projection to a frame, and turn land features into a
 * Path2D or an SVG path string.
 *
 * WHY EQUIRECTANGULAR: every source project used it, and for a background map
 * it is the right call — longitude maps linearly to x, so the map TILES
 * horizontally. A scrolling or wrapping world map is trivial with
 * equirectangular and impossible with most alternatives. `projectionFactory`
 * lets you pass something else when you want a subject rather than a texture.
 *
 * ON DATA: this module does not bundle Natural Earth. Pass GeoJSON in. The
 * source projects loaded `world-atlas` or a trimmed local file; which one is a
 * project decision, not a library one. `loadLand` is a convenience for the
 * common case of fetching TopoJSON-derived GeoJSON from a URL.
 *
 * PARAMETERS (fitProjection)
 *   land        GeoJSON FeatureCollection or Geometry to fit.
 *   width, height  Frame size.
 *   padding     Inset in px on each side. Default 0.
 *   projectionFactory  Defaults to `geoEquirectangular`.
 *   fitWorld    When true, fits a full 360 degrees of longitude rather than the
 *               data's own bounds. Default true — this is what makes the result
 *               tile horizontally. Set false to frame a single continent.
 *
 * GOTCHA: Antarctica dominates an equirectangular fit and pushes everything
 * else into the upper half of the frame. Most of the source projects dropped it
 * before fitting. `dropAntarctica` does that for you.
 *
 * EXAMPLE
 *   const land = await loadLand(LAND_URL);
 *   const { projection, path } = fitProjection({ land: dropAntarctica(land), width, height });
 *   ctx.fill(new Path2D(path(land)!));
 */
import {
  geoEquirectangular,
  geoPath,
  type GeoPermissibleObjects,
  type GeoProjection,
  type GeoPath,
} from 'd3-geo';

/**
 * Minimal structural types for the GeoJSON we accept. Kept local rather than
 * pulling in @types/geojson, so the library has one dependency, not two.
 */
export type GeoFeature = {
  type: 'Feature';
  geometry: unknown;
  properties?: Record<string, unknown> | null;
};

export type GeoCollection = {
  type: 'FeatureCollection';
  features: GeoFeature[];
};

export type LandInput = GeoCollection | GeoFeature | GeoPermissibleObjects;

export type FitProjectionOptions = {
  land: LandInput;
  width: number;
  height: number;
  padding?: number;
  projectionFactory?: () => GeoProjection;
  fitWorld?: boolean;
};

export type FittedProjection = {
  projection: GeoProjection;
  /** d3 path generator bound to the fitted projection. */
  path: GeoPath;
  /** Projects [lon, lat] to frame coordinates, or null if unprojectable. */
  project: (lonLat: [number, number]) => [number, number] | null;
  width: number;
  height: number;
};

export const fitProjection = ({
  land,
  width,
  height,
  padding = 0,
  projectionFactory = geoEquirectangular,
  fitWorld = true,
}: FitProjectionOptions): FittedProjection => {
  const projection = projectionFactory();
  const extent: [[number, number], [number, number]] = [
    [padding, padding],
    [width - padding, height - padding],
  ];

  if (fitWorld) {
    // Fitting the whole sphere rather than the data's bounds is what keeps
    // longitude linear across the full frame width, so the map tiles.
    projection.fitExtent(extent, { type: 'Sphere' } as GeoPermissibleObjects);
  } else {
    projection.fitExtent(extent, land as GeoPermissibleObjects);
  }

  const path = geoPath(projection);

  return {
    projection,
    path,
    project: (lonLat) => {
      const p = projection(lonLat);
      return p ? [p[0], p[1]] : null;
    },
    width,
    height,
  };
};

/**
 * Removes Antarctica from a FeatureCollection.
 *
 * Matches on common name properties. A collection without name properties is
 * returned unchanged rather than guessed at.
 */
export const dropAntarctica = (collection: GeoCollection): GeoCollection => ({
  type: 'FeatureCollection',
  features: collection.features.filter((f) => {
    const props = f.properties ?? {};
    const name = String(props.name ?? props.NAME ?? props.admin ?? '');
    return name.toLowerCase() !== 'antarctica';
  }),
});

/**
 * Fetches GeoJSON from a URL.
 *
 * Provided because every source project needed it, but kept trivial — if you
 * have the data locally, import it directly and skip this.
 */
export const loadLand = async (url: string): Promise<GeoCollection> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`loadLand: ${url} responded ${response.status}`);
  }
  return (await response.json()) as GeoCollection;
};
