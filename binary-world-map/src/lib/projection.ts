import {geoEquirectangular, geoPath} from "d3-geo";
import type {GeoPermissibleObjects} from "d3-geo";

/**
 * A plate carree projection pinned by explicit centre and scale rather than
 * fitted to a bounding box.
 *
 * Fitting to the data would letterbox a 2:1 world inside a 16:9 frame; naming
 * the centre longitude/latitude and the pixels-per-radian directly lets the
 * framing be chosen deliberately — here, wide enough to keep Alaska and New
 * Zealand in shot while still filling the height.
 *
 * The projected path is built once. The push-in is applied downstream as a
 * transform on the composited result, never by re-projecting: re-projecting per
 * frame would cost more than the entire rest of the render.
 */
export type MapProjection = {
  project: (lonLat: [number, number]) => [number, number] | null;
  /** Traces the geometry into an existing 2D context or Path2D. */
  trace: (ctx: CanvasRenderingContext2D | Path2D, object: GeoPermissibleObjects) => void;
  path2d: (object: GeoPermissibleObjects) => Path2D;
};

export const createEquirectangular = (opts: {
  width: number;
  height: number;
  /** Longitude at the horizontal centre of the frame. */
  centerLon: number;
  /** Latitude at the vertical centre of the frame. */
  centerLat: number;
  /** Pixels per radian. Larger = tighter framing. */
  scale: number;
}): MapProjection => {
  const degToPx = (opts.scale * Math.PI) / 180;
  const projection = geoEquirectangular()
    .rotate([-opts.centerLon, 0])
    .scale(opts.scale)
    .translate([opts.width / 2, opts.height / 2 + opts.centerLat * degToPx]);

  return {
    project: (lonLat) => projection(lonLat) ?? null,
    trace: (ctx, object) => {
      // d3-geo's canvas renderer accepts anything with the Path2D-ish surface.
      geoPath(projection, ctx as CanvasRenderingContext2D)(object);
    },
    path2d: (object) => {
      const p = new Path2D();
      geoPath(projection, p as unknown as CanvasRenderingContext2D)(object);
      return p;
    },
  };
};
