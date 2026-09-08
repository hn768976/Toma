/**
 * Geometry helpers shared by the asset builder: part clustering, framing,
 * projected-path collection and label placement.
 */

import {geoArea, geoBounds, geoConicConformal, geoMercator, geoPath} from 'd3-geo';
import type {GeoProjection} from 'd3-geo';
import type {
  BakedFraming,
  FramingOverride,
  ProjectionKind,
} from '../../src/geo/projection';
import {
  DEFAULT_GAP_DEG,
  DEFAULT_MAX_HEIGHT_FRAC,
  DEFAULT_MAX_WIDTH_FRAC,
  normLon,
} from '../../src/geo/projection';

export type Ring = number[][];
export type PolygonCoords = Ring[];
export type AnyGeometry =
  | {type: 'Polygon'; coordinates: PolygonCoords}
  | {type: 'MultiPolygon'; coordinates: PolygonCoords[]}
  | {type: 'LineString'; coordinates: Ring}
  | {type: 'MultiLineString'; coordinates: Ring[]}
  | {type: 'Point'; coordinates: number[]};

export interface Feature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: AnyGeometry;
}

/** Every polygon of a (Multi)Polygon, as standalone Polygon geometries. */
export const explodePolygons = (g: AnyGeometry): PolygonCoords[] => {
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
};

export const asMultiPolygon = (polys: PolygonCoords[]) => ({
  type: 'MultiPolygon' as const,
  coordinates: polys,
});

/** Longitude interval of a polygon, wrap-aware: [start, span] with span <= 360. */
const lonInterval = (bounds: [[number, number], [number, number]]): [number, number] => {
  const [[w, ], [e, ]] = bounds;
  const span = w > e ? 360 - (w - e) : e - w;
  return [w, span];
};

/** Smallest angular separation between two longitude intervals, in degrees. */
const lonGap = (a: [number, number], b: [number, number]): number => {
  // Separation is zero if the intervals overlap on the circle.
  const inA = (l: number) => {
    const d = normLon(l - a[0]);
    return d >= 0 && d <= a[1];
  };
  const inB = (l: number) => {
    const d = normLon(l - b[0]);
    return d >= 0 && d <= b[1];
  };
  if (inA(b[0]) || inA(normLon(b[0] + b[1])) || inB(a[0]) || inB(normLon(a[0] + a[1]))) {
    return 0;
  }
  const gaps = [
    Math.abs(normLon(b[0] - normLon(a[0] + a[1]))),
    Math.abs(normLon(a[0] - normLon(b[0] + b[1]))),
  ];
  return Math.min(...gaps);
};

interface Part {
  coords: PolygonCoords;
  area: number;
  bounds: [[number, number], [number, number]];
}

/** Ground-ish angular gap between two parts, latitude-corrected. */
const partGap = (p: Part, q: Part): number => {
  const [[, s1], [, n1]] = p.bounds;
  const [[, s2], [, n2]] = q.bounds;
  const dLat = Math.max(0, Math.max(s1 - n2, s2 - n1));
  const dLon = lonGap(lonInterval(p.bounds), lonInterval(q.bounds));
  const midLat = ((s1 + n1) / 2 + (s2 + n2) / 2) / 2;
  const dLonGround = dLon * Math.cos((midLat * Math.PI) / 180);
  return Math.hypot(dLat, dLonGround);
};

/**
 * Which parts of a country the framing must contain.
 *
 * Single-linkage clustering by angular gap, keeping the cluster that holds the
 * largest part. This is the house rule for scattered territories: an archipelago
 * chains island to island and stays whole (Indonesia, the Philippines), while a
 * genuinely distant holding (French Guiana, Hawai'i, Easter Island) falls out.
 * The gap is tunable per country and can be switched off entirely.
 */
export const framingParts = (
  geometry: AnyGeometry,
  override: FramingOverride = {}
): {geometry: AnyGeometry; kept: number; total: number} => {
  const polys = explodePolygons(geometry);
  if (polys.length <= 1 || override.includeAllParts) {
    return {geometry, kept: polys.length, total: polys.length};
  }
  const gapDeg = override.gapDeg ?? DEFAULT_GAP_DEG;
  const parts: Part[] = polys.map((coords) => {
    const g = {type: 'Polygon' as const, coordinates: coords};
    return {coords, area: geoArea(g as never), bounds: geoBounds(g as never)};
  });

  const parent = parts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => {
    parent[find(i)] = find(j);
  };
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (partGap(parts[i], parts[j]) <= gapDeg) union(i, j);
    }
  }

  let biggest = 0;
  for (let i = 1; i < parts.length; i++) if (parts[i].area > parts[biggest].area) biggest = i;
  const root = find(biggest);
  const kept = parts.filter((_, i) => find(i) === root);
  return {
    geometry: asMultiPolygon(kept.map((p) => p.coords)),
    kept: kept.length,
    total: parts.length,
  };
};

/**
 * Auto-frame a country, then apply the per-country manual correction.
 *
 * The subject's projected bounding box is fitted into a box that is a fraction
 * of the frame, so the country lands in roughly the central third with real
 * geographic context around it. Elongated countries bind on their long axis,
 * which is why the fractions are per-country tunable.
 */
export const computeFraming = (
  fitGeometry: AnyGeometry,
  width: number,
  height: number,
  override: FramingOverride = {}
): BakedFraming => {
  const [[w, s], [e, n]] = geoBounds(fitGeometry as never);
  const crossesAntimeridian = w > e;
  const span = crossesAntimeridian ? 360 - (w - e) : e - w;
  const lon0 = override.centerLon ?? normLon(w + span / 2);
  const lat0 = (s + n) / 2;

  const spansEquator = s < 0 && n > 0;
  const kind: ProjectionKind =
    override.projection ?? (Math.abs(lat0) < 22 || spansEquator ? 'mercator' : 'conicConformal');

  const latSpan = n - s;
  const parallels: [number, number] =
    override.parallels ?? [s + latSpan / 6, n - latSpan / 6];

  const base =
    kind === 'conicConformal'
      ? geoConicConformal().parallels(parallels)
      : geoMercator();
  const projection = base.rotate([-lon0, 0, 0]).precision(0.1) as GeoProjection;

  const maxW = (override.maxWidthFrac ?? DEFAULT_MAX_WIDTH_FRAC) * width;
  const maxH = (override.maxHeightFrac ?? DEFAULT_MAX_HEIGHT_FRAC) * height;
  projection.fitExtent(
    [
      [(width - maxW) / 2, (height - maxH) / 2],
      [(width + maxW) / 2, (height + maxH) / 2],
    ],
    fitGeometry as never
  );

  // Manual correction: zoom about the frame centre, then shift.
  const zoom = override.zoom ?? 1;
  const [ox, oy] = override.offset ?? [0, 0];
  const t = projection.translate();
  const cx = width / 2;
  const cy = height / 2;
  projection
    .scale(projection.scale() * zoom)
    .translate([
      cx + (t[0] - cx) * zoom + ox * width,
      cy + (t[1] - cy) * zoom + oy * height,
    ]);

  return {
    kind,
    rotate: [-lon0, 0, 0],
    ...(kind === 'conicConformal' ? {parallels} : {}),
    scale: projection.scale(),
    translate: projection.translate() as [number, number],
  };
};

/** A d3-geo path context that collects projected rings instead of drawing. */
export class RingCollector {
  rings: number[][][] = [];
  private cur: number[][] | null = null;
  beginPath() {
    this.rings = [];
    this.cur = null;
  }
  moveTo(x: number, y: number) {
    this.cur = [[x, y]];
    this.rings.push(this.cur);
  }
  lineTo(x: number, y: number) {
    this.cur?.push([x, y]);
  }
  closePath() {}
  arc() {}
}

export const collectRings = (
  projection: GeoProjection,
  geometry: AnyGeometry
): number[][][] => {
  const ctx = new RingCollector();
  const path = geoPath(projection, ctx as never);
  ctx.beginPath();
  path(geometry as never);
  return ctx.rings.filter((r) => r.length > 2);
};

export const pointInRings = (rings: number[][][], px: number, py: number): boolean => {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
};

/**
 * A label anchor inside the visible part of a shape: the cell of a coarse grid
 * that is furthest from anything that is not the shape (including the frame
 * edge). This is what keeps "CHILE" off the Pacific and neighbour names inside
 * the sliver of territory that actually made it into frame.
 */
export const labelAnchor = (
  rings: number[][][],
  width: number,
  height: number,
  cols = 192
): {x: number; y: number; clearance: number} | null => {
  const rows = Math.round((cols * height) / width);
  const cw = width / cols;
  const ch = height / rows;
  const inside = new Uint8Array(cols * rows);
  let any = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pointInRings(rings, (c + 0.5) * cw, (r + 0.5) * ch)) {
        inside[r * cols + c] = 1;
        any = true;
      }
    }
  }
  if (!any) return null;

  // Chamfer distance transform; cells outside the shape (and off-grid) are seeds.
  const INF = 1e9;
  const dist = new Float64Array(cols * rows);
  for (let i = 0; i < dist.length; i++) dist[i] = inside[i] ? INF : 0;
  const at = (c: number, r: number) => (c < 0 || r < 0 || c >= cols || r >= rows ? 0 : dist[r * cols + c]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inside[r * cols + c]) continue;
      const i = r * cols + c;
      dist[i] = Math.min(dist[i], at(c - 1, r) + 1, at(c, r - 1) + 1, at(c - 1, r - 1) + 1.414, at(c + 1, r - 1) + 1.414);
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      if (!inside[r * cols + c]) continue;
      const i = r * cols + c;
      dist[i] = Math.min(dist[i], at(c + 1, r) + 1, at(c, r + 1) + 1, at(c + 1, r + 1) + 1.414, at(c - 1, r + 1) + 1.414);
    }
  }

  let best = -1;
  let bi = 0;
  for (let i = 0; i < dist.length; i++) {
    if (inside[i] && dist[i] > best) {
      best = dist[i];
      bi = i;
    }
  }
  const c = bi % cols;
  const r = Math.floor(bi / cols);
  return {x: (c + 0.5) * cw, y: (r + 0.5) * ch, clearance: best * cw};
};

export const ringsBBox = (rings: number[][][]) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
};
