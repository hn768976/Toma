/**
 * Turns land polygons into a set of lat/lon points suitable for a dotted globe.
 *
 * Two decisions drive this module.
 *
 * 1. The land test is done against a raster, not the polygons. Point-in-polygon
 *    over ~130 Natural Earth rings, for tens of thousands of candidate points,
 *    is slow enough to be felt. Painting the land once into an equirectangular
 *    bitmap turns every subsequent test into an array lookup.
 *
 * 2. Sampling is angular, and each latitude band gets a longitude count scaled
 *    by cos(latitude). Spacing dots evenly in *screen* space makes them bunch
 *    at the sphere's edge, which reads as a flat disc with a dense rim; a naive
 *    uniform lat/lon grid instead bunches them at the poles. Scaling by cosine
 *    keeps the spacing roughly constant across the actual surface.
 *
 * The result is rotation-independent, so it is computed once and reused for
 * every frame — only projection and culling happen per frame.
 */
import { geoEquirectangular, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { scratchContext } from "./scratchCanvas";

export type LandMask = {
  width: number;
  height: number;
  /** One byte per pixel: non-zero where there is land. */
  data: Uint8Array;
};

/**
 * Paints `land` into an equirectangular bitmap. The projection is fitted so
 * that longitude -180..180 maps exactly onto 0..width and latitude 90..-90 onto
 * 0..height, which makes the lookup in `isLand` a plain rescale.
 */
export const rasteriseLandMask = (
  land: GeoPermissibleObjects,
  width = 2048,
): LandMask => {
  const height = Math.round(width / 2);
  const ctx = scratchContext("land-mask", width, height);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);

  const projection = geoEquirectangular()
    .translate([width / 2, height / 2])
    .scale(width / (2 * Math.PI));

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  geoPath(projection, ctx)(land);
  ctx.fill();

  const rgba = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3];
  return { width, height, data };
};

export const isLand = (mask: LandMask, lon: number, lat: number): boolean => {
  const px = Math.floor(((lon + 180) / 360) * mask.width);
  const py = Math.floor(((90 - lat) / 180) * mask.height);
  if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) return false;
  return mask.data[py * mask.width + px] > 127;
};

/**
 * A sampled land point, carried as a unit vector on the sphere alongside its
 * geographic coordinates. Storing the vector costs nothing here and lets a
 * consumer do visibility maths without re-deriving it every frame.
 */
export type LandPoint = {
  lon: number;
  lat: number;
};

export type SampleOptions = {
  /** Angular spacing between dots, in degrees. */
  stepDeg?: number;
  /**
   * Half-step horizontal offset on alternate bands. Breaks up the vertical
   * "corduroy" a plain grid produces, at no cost.
   */
  stagger?: boolean;
  /** Bands closer to the poles than this are dropped. */
  maxAbsLat?: number;
};

export const sampleLandPoints = (
  mask: LandMask,
  options: SampleOptions = {},
): LandPoint[] => {
  const { stepDeg = 1.5, stagger = true, maxAbsLat = 86 } = options;
  const points: LandPoint[] = [];
  const bands = Math.floor(180 / stepDeg);

  for (let b = 0; b < bands; b++) {
    const lat = -90 + stepDeg * (b + 0.5);
    if (Math.abs(lat) > maxAbsLat) continue;
    const cos = Math.cos((lat * Math.PI) / 180);
    const lonCount = Math.max(1, Math.round((360 * cos) / stepDeg));
    const lonStep = 360 / lonCount;
    const offset = stagger && b % 2 === 1 ? lonStep / 2 : 0;
    for (let i = 0; i < lonCount; i++) {
      const lon = -180 + offset + lonStep * i;
      if (isLand(mask, lon, lat)) points.push({ lon, lat });
    }
  }
  return points;
};
