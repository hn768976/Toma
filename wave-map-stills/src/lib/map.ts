import {geoEquirectangular, geoPath, type GeoProjection} from "d3-geo";
import type {MultiPolygon} from "geojson";
import {merge} from "topojson-client";
import type {CompositionSpec} from "./compositions";

/**
 * Natural Earth 110m country polygons, as shipped in world-atlas.
 * Public domain — no attribution required.
 */
export type CountryTopology = {
  type: "Topology";
  objects: {
    countries: {
      type: "GeometryCollection";
      geometries: {properties?: {name?: string}}[];
    };
  };
};

/** Antarctic landmasses are omitted from the piece. */
const OMITTED = new Set(["Antarctica", "Fr. S. Antarctic Lands"]);

export const landWithoutAntarctica = (topo: CountryTopology): MultiPolygon => {
  const geoms = topo.objects.countries.geometries.filter(
    (g) => !OMITTED.has(g.properties?.name ?? ""),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return merge(topo as any, geoms as any) as MultiPolygon;
};

/**
 * Equirectangular projection into FIELD space (screen space before the
 * composition's tilt is applied). `lonSpan` degrees of longitude fill the
 * frame width, and `center` lands at the middle of the frame.
 */
export const buildProjection = (
  comp: CompositionSpec,
  width: number,
  height: number,
): GeoProjection =>
  geoEquirectangular()
    .scale(width / ((comp.lonSpan * Math.PI) / 180))
    .rotate([-comp.center[0], 0])
    .center([0, comp.center[1]])
    .translate([width / 2, height / 2]);

export type LandMask = {
  /** Padded field rectangle, in field-space px. */
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** Resolution of the mask relative to field space. */
  res: number;
  data: Uint8Array;
  cols: number;
  rows: number;
};

/**
 * Rasterise the land polygons once into a coverage mask. Testing 200k grid
 * points against 170 polygons directly would be far too slow; a raster lookup
 * is O(1) per point and, at this dot pitch, indistinguishable.
 */
export const rasteriseLand = (
  land: MultiPolygon,
  projection: GeoProjection,
  x0: number,
  y0: number,
  w: number,
  h: number,
  res: number,
): LandMask => {
  const cols = Math.max(1, Math.ceil(w * res));
  const rows = Math.max(1, Math.ceil(h * res));
  const cv = document.createElement("canvas");
  cv.width = cols;
  cv.height = rows;
  const ctx = cv.getContext("2d", {willReadFrequently: true});
  if (!ctx) {
    throw new Error("2d context unavailable for the land mask");
  }
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, cols, rows);
  ctx.save();
  ctx.scale(res, res);
  ctx.translate(-x0, -y0);
  ctx.beginPath();
  geoPath(projection, ctx)(land);
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.fill();
  ctx.restore();

  const px = ctx.getImageData(0, 0, cols, rows).data;
  const data = new Uint8Array(cols * rows);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = px[p] > 110 ? 1 : 0;
  }
  return {x0, y0, w, h, res, data, cols, rows};
};

export const sampleMask = (m: LandMask, fx: number, fy: number): number => {
  const cx = Math.floor((fx - m.x0) * m.res);
  const cy = Math.floor((fy - m.y0) * m.res);
  if (cx < 0 || cy < 0 || cx >= m.cols || cy >= m.rows) {
    return 0;
  }
  return m.data[cy * m.cols + cx];
};
