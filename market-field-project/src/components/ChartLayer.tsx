import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { planeTransform, planesAt, type Plane } from "../camera";
import { lighten, rgba } from "../color";
import { CHART, FALLING_ENVELOPE, RISING_ENVELOPE, SEED } from "../config";
import type { Palette } from "../palettes";
import { buildSeries, type SeriesGeometry } from "../series";

/** Stops for the along-the-length brightness shimmer. */
const SHIMMER_STOPS = 15;

const shimmerStops = (color: string, t: number, phase: number) =>
  Array.from({ length: SHIMMER_STOPS }, (_, k) => {
    const o = k / (SHIMMER_STOPS - 1);
    // Both terms complete a whole number of cycles over the loop, so the
    // shimmer arrives back where it started at frame 600.
    const m =
      0.5 +
      0.32 * Math.sin(Math.PI * 2 * (2.5 * o - t + phase)) +
      0.18 * Math.sin(Math.PI * 2 * (6 * o + 2 * t + phase * 1.7));
    const clamped = Math.min(Math.max(m, 0), 1);
    return (
      <stop
        key={k}
        offset={o}
        stopColor={lighten(color, 0.34 * clamped)}
        stopOpacity={0.76 + 0.24 * clamped}
      />
    );
  });

/**
 * One copy of the chart pair, sitting on one plane of the camera lattice.
 *
 * Glow and fill softening are lens effects, so their radii are divided by
 * the plane's scale to stay constant on screen rather than swelling with the
 * plane. That is both the truer look and what keeps a plane sweeping past
 * the camera from costing a full-frame blur at three times the radius.
 */
const ChartPlane: React.FC<{
  plane: Plane;
  id: string;
  palette: Palette;
  rising: SeriesGeometry;
  falling: SeriesGeometry;
  t: number;
}> = ({ plane, id, palette, rising, falling, t }) => {
  const { width, height } = useVideoConfig();
  const s = plane.scale;
  const strokeWidth = width * CHART.strokeWidth;
  // The widest bloom pass is worth its cost only on a plane large enough to
  // show it and bright enough to be looked at.
  const wideGlow = s > 0.55 && s < 1.75;
  // Screen-space blur, expressed in this plane's own (scaled) user units.
  const dof = (plane.dof * width) / s;

  return (
    <g
      opacity={plane.opacity}
      transform={planeTransform(s, width, height)}
      filter={dof > 0.4 ? `url(#dof-${id})` : undefined}
    >
      <defs>
        {dof > 0.4 ? (
          <filter id={`dof-${id}`} x="-16%" y="-16%" width="132%" height="132%">
            <feGaussianBlur stdDeviation={dof} />
          </filter>
        ) : null}
        {(
          [
            ["rising", palette.rising],
            ["falling", palette.falling],
          ] as const
        ).map(([name, colors]) => (
          <linearGradient key={name} id={`fill-${name}-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={colors.fill} stopOpacity={CHART.fillTopOpacity * palette.fillBoost} />
            <stop offset="0.16" stopColor={colors.fill} stopOpacity={CHART.fillMidOpacity * palette.fillBoost} />
            <stop offset="0.44" stopColor={colors.fill} stopOpacity={CHART.fillMidOpacity * palette.fillBoost * 0.4} />
            <stop offset="0.78" stopColor={colors.fill} stopOpacity={0} />
          </linearGradient>
        ))}

        <linearGradient id={`fill-overlap-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.overlap} stopOpacity={0.4 * palette.overlapStrength} />
          <stop offset="0.32" stopColor={palette.overlap} stopOpacity={0.19 * palette.overlapStrength} />
          <stop offset="0.72" stopColor={palette.overlap} stopOpacity={0} />
        </linearGradient>

        <linearGradient
          id={`stroke-rising-${id}`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={width}
          y2="0"
        >
          {shimmerStops(palette.rising.stroke, t, 0)}
        </linearGradient>
        <linearGradient
          id={`stroke-falling-${id}`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={width}
          y2="0"
        >
          {shimmerStops(palette.falling.stroke, t, 0.37)}
        </linearGradient>

        <filter id={`fill-soften-${id}`} x="-14%" y="-14%" width="128%" height="128%">
          <feGaussianBlur stdDeviation={(width * CHART.fillBlur) / s} />
        </filter>
        <filter id={`glow-outer-${id}`} x="-18%" y="-18%" width="136%" height="136%">
          <feGaussianBlur stdDeviation={(width * CHART.outerGlowBlur) / s} />
        </filter>
        <filter id={`glow-inner-${id}`} x="-14%" y="-14%" width="128%" height="128%">
          <feGaussianBlur stdDeviation={(width * CHART.innerGlowBlur) / s} />
        </filter>

        <clipPath id={`clip-rising-area-${id}`}>
          <path d={rising.areaPath} />
        </clipPath>
      </defs>

      {/*
        Fills. The two areas are combined additively rather than alpha
        stacked, and the intersection carries an extra tint — that lighter
        wedge where the series overlap is the signature of the look.
      */}
      <g filter={`url(#fill-soften-${id})`}>
        <path d={rising.areaPath} fill={`url(#fill-rising-${id})`} />
        <path
          d={falling.areaPath}
          fill={`url(#fill-falling-${id})`}
          style={{ mixBlendMode: "screen" }}
        />
        <g clipPath={`url(#clip-rising-area-${id})`} style={{ mixBlendMode: "screen" }}>
          <path d={falling.areaPath} fill={`url(#fill-overlap-${id})`} />
        </g>
      </g>

      {/* Bloom passes: wide and dim, then tight and brighter. */}
      <g style={{ mixBlendMode: "screen" }}>
        {wideGlow ? (
          <g filter={`url(#glow-outer-${id})`} opacity={0.42}>
            <path
              d={rising.linePath}
              fill="none"
              stroke={`url(#stroke-rising-${id})`}
              strokeWidth={(width * CHART.outerGlowWidth) / s}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={falling.linePath}
              fill="none"
              stroke={`url(#stroke-falling-${id})`}
              strokeWidth={(width * CHART.outerGlowWidth) / s}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ) : null}
        <g filter={`url(#glow-inner-${id})`} opacity={0.85}>
          <path
            d={rising.linePath}
            fill="none"
            stroke={`url(#stroke-rising-${id})`}
            strokeWidth={(width * CHART.innerGlowWidth) / s}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={falling.linePath}
            fill="none"
            stroke={`url(#stroke-falling-${id})`}
            strokeWidth={(width * CHART.innerGlowWidth) / s}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        {/* The lines themselves. These are geometry, not lens effects, so
            they thicken with the plane as it comes at the camera. */}
        <path
          d={rising.linePath}
          fill="none"
          stroke={`url(#stroke-rising-${id})`}
          strokeWidth={strokeWidth * 1.9}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
        <path
          d={falling.linePath}
          fill="none"
          stroke={`url(#stroke-falling-${id})`}
          strokeWidth={strokeWidth * 1.9}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
        <path
          d={rising.linePath}
          fill="none"
          stroke={rgba(lighten(palette.rising.stroke, 0.62), 0.85)}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={falling.linePath}
          fill="none"
          stroke={rgba(lighten(palette.falling.stroke, 0.62), 0.85)}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
};

export const ChartLayer: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const rising = useMemo(
    () =>
      buildSeries({
        frame,
        width,
        height,
        seed: SEED,
        envelope: RISING_ENVELOPE,
      }),
    [frame, width, height],
  );

  const falling = useMemo(
    () =>
      buildSeries({
        frame,
        width,
        height,
        seed: SEED ^ 0x00c0ffee,
        envelope: FALLING_ENVELOPE,
      }),
    [frame, width, height],
  );

  const t = frame / durationInFrames;
  const planes = planesAt(t);

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {planes.map((plane, i) => (
          <ChartPlane
            key={i}
            id={String(i)}
            plane={plane}
            palette={palette}
            rising={rising}
            falling={falling}
            t={t}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
