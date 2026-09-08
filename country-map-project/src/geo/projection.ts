/**
 * Shared projection + framing maths.
 *
 * This module is imported by BOTH the offline asset builder (scripts/build-assets.ts)
 * and — indirectly, through the baked region JSON — by the Remotion compositions.
 * Keeping one implementation is what guarantees that the pre-warped relief raster
 * and the SVG vectors stay pixel-registered.
 */

import {
  geoConicConformal,
  geoEquirectangular,
  geoMercator,
  type GeoProjection,
} from 'd3-geo';

export type ProjectionKind = 'mercator' | 'conicConformal';

/**
 * A framing, fully resolved to numbers. Baked into the region JSON so that
 * nothing has to be recomputed at render time.
 */
export interface BakedFraming {
  kind: ProjectionKind;
  /** d3 rotate triple. Only lambda is ever non-zero; it re-centres longitude and
   *  is what makes antimeridian-crossing countries (Fiji) project correctly. */
  rotate: [number, number, number];
  /** Standard parallels, conicConformal only. */
  parallels?: [number, number];
  scale: number;
  translate: [number, number];
}

/** Per-country manual corrections. Everything is optional; the defaults frame
 *  the great majority of countries correctly on their own. */
export interface FramingOverride {
  /** Multiply the auto-computed scale. >1 pushes in, <1 pulls out. */
  zoom?: number;
  /** Shift the map, as a fraction of frame width / height. Positive x moves the
   *  map right (i.e. the subject sits further right in frame). */
  offset?: [number, number];
  /** Fraction of the frame the subject's projected bounding box may occupy.
   *  The tighter of the two binds, so an elongated country fits by its long axis. */
  maxWidthFrac?: number;
  maxHeightFrac?: number;
  /** Force a projection family instead of letting latitude decide. */
  projection?: ProjectionKind;
  /** Force standard parallels (conicConformal). */
  parallels?: [number, number];
  /** Force the central meridian instead of using the subject's mid-longitude. */
  centerLon?: number;
  /** Single-linkage clustering gap, in degrees, used to decide which disjoint
   *  parts of a country the framing must contain. Default 8 (~900 km). */
  gapDeg?: number;
  /** Ignore clustering and frame every part, however distant. */
  includeAllParts?: boolean;
  /** Nudge the big country title, as a fraction of frame width / height. */
  titleOffset?: [number, number];
}

export const DEFAULT_MAX_WIDTH_FRAC = 0.44;
export const DEFAULT_MAX_HEIGHT_FRAC = 0.56;
export const DEFAULT_GAP_DEG = 8;

/** Rebuild a live d3 projection from a baked framing. */
export const buildProjection = (f: BakedFraming): GeoProjection => {
  const p =
    f.kind === 'conicConformal'
      ? geoConicConformal().parallels(f.parallels ?? [30, 60])
      : geoMercator();
  return p.rotate(f.rotate).scale(f.scale).translate(f.translate).precision(0.1);
};

/**
 * The V3 world plane. Plain equirectangular over the whole globe, sized so the
 * plane is exactly `planeWidth` x `planeWidth / 2`. The satellite raster is an
 * unprojected equirectangular image, so this projection lines up with it exactly.
 */
export const buildPlaneProjection = (planeWidth: number): GeoProjection =>
  geoEquirectangular()
    .translate([planeWidth / 2, planeWidth / 4])
    .scale(planeWidth / (2 * Math.PI))
    .precision(0.1);

/** Normalise to (-180, 180]. */
export const normLon = (lon: number): number => {
  let l = ((lon + 180) % 360) - 180;
  if (l <= -180) l += 360;
  return l;
};

/** Signed shortest angular difference b - a, in (-180, 180]. */
export const lonDelta = (a: number, b: number): number => normLon(b - a);
