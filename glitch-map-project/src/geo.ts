import {geoAlbersUsa, geoConicEqualArea, geoMercator, geoPath} from 'd3-geo';
import type {GeoProjection} from 'd3-geo';
import type {Country, MultiPolygon} from './countries';

/** The country's longest dimension, as a fraction of frame width. */
const TARGET_LONGEST = 0.62;
/** Generous margin: the glitch field needs room to read around the map. */
const MAX_WIDTH = 0.86;
const MAX_HEIGHT = 0.8;
/** A scaleOverride can push past the soft limits, but never off the frame. */
const HARD_MAX_WIDTH = 0.92;
const HARD_MAX_HEIGHT = 0.86;

const makeProjection = (country: Country): GeoProjection => {
  switch (country.projection) {
    case 'albersUsa':
      // A composite: no rotation to apply, the layout is baked into it.
      return geoAlbersUsa();
    case 'conicEqualArea':
      return geoConicEqualArea().rotate([-country.rotateLon, 0]).parallels([50, 70]);
    case 'mercator':
    default:
      return geoMercator().rotate([-country.rotateLon, 0]);
  }
};

/**
 * Parts sorted largest first, so the main landmass traces before the small
 * islands. Purely a draw-order choice - no ring is altered.
 */
const sortPartsByExtent = (geometry: MultiPolygon, project: (p: [number, number]) => [number, number] | null): MultiPolygon => {
  const scored = geometry.coordinates.map((poly) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const point of poly[0]) {
      const p = project(point as [number, number]);
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    const extent = Number.isFinite(x0) ? (x1 - x0) * (y1 - y0) : -1;
    return {poly, extent};
  });
  scored.sort((a, b) => b.extent - a.extent);
  return {type: 'MultiPolygon', coordinates: scored.map((s) => s.poly)};
};

/** Total length of an M/L/Z polyline path, in user units. */
export const measurePathLength = (d: string): number => {
  let length = 0;
  let startX = 0, startY = 0, curX = 0, curY = 0;
  let command = '';
  const tokens = d.match(/[MLZmlz]|-?[\d.]+(?:e-?\d+)?/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/[MLZmlz]/.test(token)) {
      command = token.toUpperCase();
      if (command === 'Z') {
        length += Math.hypot(startX - curX, startY - curY);
        curX = startX;
        curY = startY;
      }
      continue;
    }
    const x = Number(token);
    const y = Number(tokens[++i]);
    if (command === 'M') {
      startX = curX = x;
      startY = curY = y;
    } else {
      length += Math.hypot(x - curX, y - curY);
      curX = x;
      curY = y;
    }
  }
  return length;
};

export type CountryGeometry = {
  /** SVG path data for the whole country, in frame pixel coordinates. */
  readonly d: string;
  /** Exact total length of `d`, used to drive the stroke-dash trace. */
  readonly length: number;
  /** Projected bounding box of the drawn shape, in frame pixel coordinates. */
  readonly bounds: {x0: number; y0: number; x1: number; y1: number};
};

const cache = new Map<string, CountryGeometry>();

/**
 * Projects a country and auto-fits it from its projected bounding box, so the
 * longest dimension lands at ~62% of frame width. Results are cached: the
 * geometry only depends on the country and the frame size, never on the frame
 * number, so it is computed once per composition rather than 360 times.
 */
export const buildCountryGeometry = (
  country: Country,
  width: number,
  height: number,
): CountryGeometry => {
  const key = `${country.code}:${width}x${height}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const projection = makeProjection(country);
  const geometry = country.geometry as MultiPolygon;

  // Fit into an arbitrary reference box first, to learn the projected aspect.
  projection.fitExtent(
    [
      [0, 0],
      [1000, 1000],
    ],
    geometry as never,
  );
  const sorted = sortPartsByExtent(geometry, (p) => projection(p) as [number, number] | null);

  const path = geoPath(projection);
  const [[bx0, by0], [bx1, by1]] = path.bounds(sorted as never);
  const fitWidth = bx1 - bx0;
  const fitHeight = by1 - by0;

  let scale = (TARGET_LONGEST * width) / Math.max(fitWidth, fitHeight);
  scale = Math.min(scale, (MAX_WIDTH * width) / fitWidth, (MAX_HEIGHT * height) / fitHeight);
  scale *= country.scaleOverride;
  scale = Math.min(scale, (HARD_MAX_WIDTH * width) / fitWidth, (HARD_MAX_HEIGHT * height) / fitHeight);

  const baseScale = projection.scale();
  const [tx, ty] = projection.translate();
  projection.scale(baseScale * scale);
  // Re-centre: the reference-box centre of the shape moves to the frame centre.
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  projection.translate([width / 2 + (tx - cx) * scale, height / 2 + (ty - cy) * scale]);

  const finalPath = geoPath(projection);
  const d = finalPath(sorted as never) ?? '';
  const [[fx0, fy0], [fx1, fy1]] = finalPath.bounds(sorted as never);

  const result: CountryGeometry = {
    d,
    length: measurePathLength(d),
    bounds: {x0: fx0, y0: fy0, x1: fx1, y1: fy1},
  };
  cache.set(key, result);
  return result;
};
