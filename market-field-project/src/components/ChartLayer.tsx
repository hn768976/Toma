import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { lighten, rgba } from "../color";
import { CHART, FALLING_ENVELOPE, RISING_ENVELOPE, SEED } from "../config";
import type { Palette } from "../palettes";
import { buildSeries } from "../series";

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
  const strokeWidth = width * CHART.strokeWidth;

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {(
            [
              ["rising", palette.rising],
              ["falling", palette.falling],
            ] as const
          ).map(([name, colors]) => (
            <linearGradient key={name} id={`fill-${name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={colors.fill} stopOpacity={CHART.fillTopOpacity * palette.fillBoost} />
              <stop offset="0.16" stopColor={colors.fill} stopOpacity={CHART.fillMidOpacity * palette.fillBoost} />
              <stop offset="0.44" stopColor={colors.fill} stopOpacity={CHART.fillMidOpacity * palette.fillBoost * 0.4} />
              <stop offset="0.78" stopColor={colors.fill} stopOpacity={0} />
            </linearGradient>
          ))}

          <linearGradient id="fill-overlap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={palette.overlap} stopOpacity={0.4 * palette.overlapStrength} />
            <stop offset="0.32" stopColor={palette.overlap} stopOpacity={0.19 * palette.overlapStrength} />
            <stop offset="0.72" stopColor={palette.overlap} stopOpacity={0} />
          </linearGradient>

          <linearGradient
            id="stroke-rising"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={width}
            y2="0"
          >
            {shimmerStops(palette.rising.stroke, t, 0)}
          </linearGradient>
          <linearGradient
            id="stroke-falling"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={width}
            y2="0"
          >
            {shimmerStops(palette.falling.stroke, t, 0.37)}
          </linearGradient>

          <filter id="fill-soften" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation={width * CHART.fillBlur} />
          </filter>
          <filter id="glow-outer" x="-12%" y="-12%" width="124%" height="124%">
            <feGaussianBlur stdDeviation={width * CHART.outerGlowBlur} />
          </filter>
          <filter id="glow-inner" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation={width * CHART.innerGlowBlur} />
          </filter>

          <clipPath id="clip-rising-area">
            <path d={rising.areaPath} />
          </clipPath>
        </defs>

        {/*
          Fills. The two areas are combined additively rather than alpha
          stacked, and the intersection carries an extra tint — that lighter
          wedge where the series overlap is the signature of the look.
        */}
        <g filter="url(#fill-soften)">
          <path d={rising.areaPath} fill="url(#fill-rising)" />
          <path
            d={falling.areaPath}
            fill="url(#fill-falling)"
            style={{ mixBlendMode: "screen" }}
          />
          <g clipPath="url(#clip-rising-area)" style={{ mixBlendMode: "screen" }}>
            <path d={falling.areaPath} fill="url(#fill-overlap)" />
          </g>
        </g>

        {/* Bloom passes: wide and dim, then tight and brighter. */}
        <g style={{ mixBlendMode: "screen" }}>
          <g filter="url(#glow-outer)" opacity={0.42}>
            <path
              d={rising.linePath}
              fill="none"
              stroke="url(#stroke-rising)"
              strokeWidth={width * CHART.outerGlowWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={falling.linePath}
              fill="none"
              stroke="url(#stroke-falling)"
              strokeWidth={width * CHART.outerGlowWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
          <g filter="url(#glow-inner)" opacity={0.85}>
            <path
              d={rising.linePath}
              fill="none"
              stroke="url(#stroke-rising)"
              strokeWidth={width * CHART.innerGlowWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={falling.linePath}
              fill="none"
              stroke="url(#stroke-falling)"
              strokeWidth={width * CHART.innerGlowWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>

          {/* The crisp lines themselves, with a hot near-white core. */}
          <path
            d={rising.linePath}
            fill="none"
            stroke="url(#stroke-rising)"
            strokeWidth={strokeWidth * 1.9}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.9}
          />
          <path
            d={falling.linePath}
            fill="none"
            stroke="url(#stroke-falling)"
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
      </svg>
    </AbsoluteFill>
  );
};
