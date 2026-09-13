import React, {useMemo} from 'react';
import {getLandMask, isLand} from './world-mask';
import type {Theme} from './theme';

type Props = {
  /** Degrees of longitude the globe has turned. */
  rotation: number;
  /** Centre + radius in design-space units. */
  cx: number;
  cy: number;
  radius: number;
  theme: Theme;
};

/** Viewing tilt: we look at the sphere from slightly above the equator. */
const TILT_DEG = 12;

/** Latitude sampling step. ~113 rows across the diameter matches the reference. */
const LAT_STEP = 1.35;

/**
 * The globe is drawn as horizontal dashes laid along lines of latitude — the
 * same "printed on a sphere" look as the reference, rather than round dots.
 *
 * All dashes live in three <path> elements bucketed by brightness instead of
 * one node per dash. That keeps the DOM at a handful of nodes while still
 * emitting a few thousand marks per frame, which is what makes this affordable
 * to render 331 times at 4K.
 */
export const Globe: React.FC<Props> = ({rotation, cx, cy, radius, theme}) => {
  const buckets = useMemo(() => {
    const mask = getLandMask();
    const tilt = (TILT_DEG * Math.PI) / 180;
    const sinT = Math.sin(tilt);
    const cosT = Math.cos(tilt);

    // Three brightness tiers: body, mid, and the bright limb crescent.
    const dim: string[] = [];
    const mid: string[] = [];
    const hot: string[] = [];

    // Target on-screen spacing between neighbouring marks.
    const spacing = (2 * radius) / (180 / LAT_STEP);
    const dash = spacing * 0.66;

    for (let lat = -88; lat <= 88; lat += LAT_STEP) {
      const phi = (lat * Math.PI) / 180;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      // Keep screen-space spacing even: rows near the poles need bigger
      // longitude steps because their circle of latitude is shorter.
      const lonStep = Math.min(24, (LAT_STEP / Math.max(cosPhi, 0.08)));

      for (let lon = -180; lon < 180; lon += lonStep) {
        if (!isLand(mask, lon, lat)) continue;

        const lambda = ((lon + rotation) * Math.PI) / 180;
        // Orthographic projection of the unit sphere.
        const ux = cosPhi * Math.sin(lambda);
        const uy = sinPhi;
        const uz = cosPhi * Math.cos(lambda);

        // Tilt about the screen-horizontal axis.
        const ty = uy * cosT - uz * sinT;
        const tz = uy * sinT + uz * cosT;
        if (tz <= 0.02) continue; // back hemisphere

        const sx = cx + ux * radius;
        const sy = cy - ty * radius;

        // Depth shading, plus a rim highlight that catches the right-hand limb
        // the way the reference does.
        const depth = Math.pow(tz, 0.5);
        const rim = Math.pow(Math.max(0, ux), 3) * Math.pow(1 - tz, 1.6);
        const lum = depth * 0.82 + rim * 0.55;

        // Longitude compresses towards the limb, so the dashes have to shorten
        // with it. Without this the marks overlap into a solid smear at the
        // edges instead of tightening into fine lines.
        const foreshorten = Math.max(0.14, Math.abs(Math.cos(lambda)));
        const len = dash * foreshorten;

        const seg = `M${sx.toFixed(1)} ${sy.toFixed(1)}h${len.toFixed(2)}`;
        if (lum > 0.72) hot.push(seg);
        else if (lum > 0.42) mid.push(seg);
        else dim.push(seg);
      }
    }

    return {dim: dim.join(''), mid: mid.join(''), hot: hot.join(''), stroke: spacing * 0.48};
  }, [rotation, cx, cy, radius]);

  return (
    <g>
      {/* Faint body of the sphere so the dark ocean side still reads as solid. */}
      <circle cx={cx} cy={cy} r={radius} fill={`url(#sphereBody-${theme.id})`} />

      <g strokeLinecap="round" fill="none">
        <path d={buckets.dim} stroke={theme.globeRim} strokeWidth={buckets.stroke * 0.85} opacity={0.34} />
        <path d={buckets.mid} stroke={theme.globe} strokeWidth={buckets.stroke} opacity={0.66} />
        <path d={buckets.hot} stroke={theme.globe} strokeWidth={buckets.stroke * 1.12} opacity={0.96} />
      </g>
    </g>
  );
};
