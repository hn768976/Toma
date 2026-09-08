import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { buildTimeline, getBreathState, PHASE_LABEL } from "./breath";
import { COLORS, LAYOUT } from "./design";
import { Grain } from "./Grain";
import { cycleDurationInFrames } from "./patterns";

export const patternStepSchema = z.object({
  phase: z.enum(["inhale", "hold", "exhale"]),
  seconds: z.number().positive(),
});

export const breathingPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(patternStepSchema).min(1),
});

export const breathingRingSchema = z.object({
  pattern: breathingPatternSchema,
  /**
   * Phase labels inside the ring. Off for the stock renders — buyers overlay
   * their own language, and words in the plate make the clip single-market.
   */
  showPhaseLabels: z.boolean(),
  showEchoRings: z.boolean(),
  /** Grain strength. ~0.02 is enough to stop the gradient banding in H.264. */
  grainOpacity: z.number().min(0).max(0.2),
});

export type BreathingRingProps = z.infer<typeof breathingRingSchema>;

const ECHO_RING_COUNT = 4;

export const BreathingRing: React.FC<BreathingRingProps> = ({
  pattern,
  showPhaseLabels,
  showEchoRings,
  grainOpacity,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const timeline = React.useMemo(
    () => buildTimeline(pattern, fps),
    [pattern, fps],
  );
  const cycleFrames = React.useMemo(
    () => cycleDurationInFrames(pattern, fps),
    [pattern, fps],
  );

  const breath = getBreathState(frame, timeline, cycleFrames);
  const { level, cycleProgress, phase, phaseProgress } = breath;

  const cx = width / 2;
  const cy = height / 2;

  // --- Ring geometry. Floating point throughout; nothing is rounded, because
  // any stepping in the radius is visible on a shape this slow and simple.
  const outerRadius =
    height *
    interpolate(level, [0, 1], [LAYOUT.minOuterRadius, LAYOUT.maxOuterRadius], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const bandWidth =
    height *
    interpolate(level, [0, 1], [LAYOUT.minBandWidth, LAYOUT.maxBandWidth], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  // SVG strokes straddle the path, so the path sits half a band inside the
  // outer edge.
  const bandRadius = outerRadius - bandWidth / 2;
  const innerRadius = outerRadius - bandWidth;

  const maxOuterRadius = height * LAYOUT.maxOuterRadius;
  const guideTrackWidth = height * LAYOUT.guideTrackWidth;

  // --- Brightness. A shimmer of ~1.5% keeps a hold from looking like a frozen
  // frame without moving the ring. Two cycles per loop, so it stays seamless.
  const shimmer = 1 + 0.015 * Math.sin(cycleProgress * Math.PI * 4);
  const fillAlpha =
    interpolate(level, [0, 1], [0.085, 0.2], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * shimmer;
  const ringOpacity =
    interpolate(level, [0, 1], [0.6, 0.85], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * shimmer;

  // --- The progress marker: constant angular speed, exactly one revolution per
  // cycle, clockwise from twelve o'clock — including through the holds, which
  // is what tells the viewer the exercise is still running.
  const markerAngle = cycleProgress * Math.PI * 2;
  const markerX = cx + bandRadius * Math.sin(markerAngle);
  const markerY = cy - bandRadius * Math.cos(markerAngle);
  const markerRadius = height * LAYOUT.markerRadius;

  // --- Echo rings, on the inhale only. The envelope is zero at both ends of
  // the inhale, so they appear and vanish without a cut.
  const echoEnvelope = phase === "inhale" ? Math.sin(Math.PI * phaseProgress) : 0;
  const echoes =
    showEchoRings && echoEnvelope > 0
      ? Array.from({ length: ECHO_RING_COUNT }, (_, i) => {
          const travel = interpolate(
            phaseProgress * 1.5 - i * 0.3,
            [0, 1],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          return {
            radius: outerRadius + travel * height * LAYOUT.echoTravel,
            opacity: 0.17 * echoEnvelope * (1 - travel) * 0.85 ** i,
          };
        })
      : [];

  // --- Background. Shifts almost imperceptibly with the breath.
  const backgroundRadius =
    Math.hypot(width / 2, height / 2) *
    interpolate(level, [0, 1], [1, 1.06], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const labelOpacity =
    interpolate(phaseProgress, [0, 0.12, 0.88, 1], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * 0.72;

  const ringGradientId = "ring-band-gradient";
  const fillGradientId = "ring-fill-gradient";
  const ringBloomId = "ring-bloom";
  const markerBloomId = "marker-bloom";

  const ringBand = (
    <circle
      cx={cx}
      cy={cy}
      r={bandRadius}
      fill="none"
      stroke={`url(#${ringGradientId})`}
      strokeWidth={bandWidth}
      opacity={ringOpacity}
    />
  );

  const marker = (
    <circle cx={markerX} cy={markerY} r={markerRadius} fill={COLORS.marker} />
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.backgroundEdge,
        backgroundImage: `radial-gradient(circle ${backgroundRadius}px at 50% 50%, ${COLORS.backgroundCentre} 0%, ${COLORS.backgroundMid} 45%, ${COLORS.backgroundEdge} 100%)`,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          {/* Bright at the band's inner edge, falling away to the outer edge. */}
          <radialGradient
            id={ringGradientId}
            gradientUnits="userSpaceOnUse"
            cx={cx}
            cy={cy}
            r={outerRadius}
          >
            <stop offset="0" stopColor={COLORS.ringInner} />
            <stop
              offset={Math.max(0, innerRadius / outerRadius)}
              stopColor={COLORS.ringInner}
            />
            <stop offset="1" stopColor={COLORS.ringOuter} />
          </radialGradient>

          {/* Light held inside the ring. */}
          <radialGradient
            id={fillGradientId}
            gradientUnits="userSpaceOnUse"
            cx={cx}
            cy={cy}
            r={bandRadius}
          >
            <stop offset="0" stopColor={COLORS.ringInner} stopOpacity={fillAlpha} />
            <stop
              offset="0.55"
              stopColor={COLORS.ringInner}
              stopOpacity={fillAlpha * 0.42}
            />
            <stop offset="1" stopColor={COLORS.ringInner} stopOpacity={0} />
          </radialGradient>

          <filter
            id={ringBloomId}
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={height * LAYOUT.ringBlur} />
          </filter>
          <filter
            id={markerBloomId}
            x="-300%"
            y="-300%"
            width="700%"
            height="700%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={height * LAYOUT.markerBlur} />
          </filter>
        </defs>

        {/* Guide track — the extent the ring will reach. */}
        <circle
          cx={cx}
          cy={cy}
          r={maxOuterRadius - guideTrackWidth / 2}
          fill="none"
          stroke={COLORS.guideTrack}
          strokeWidth={guideTrackWidth}
          opacity={0.55}
        />

        {/* Echo rings, behind the band. */}
        {echoes.map((echo, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={echo.radius}
            fill="none"
            stroke={COLORS.ringOuter}
            strokeWidth={height * LAYOUT.echoRingWidth}
            opacity={echo.opacity}
          />
        ))}

        {/* Interior fill. */}
        <circle cx={cx} cy={cy} r={bandRadius} fill={`url(#${fillGradientId})`} />

        {/* Bloom pass, then the crisp band on top. */}
        <g filter={`url(#${ringBloomId})`} opacity={0.55}>
          {ringBand}
        </g>
        {ringBand}

        <g filter={`url(#${markerBloomId})`} opacity={0.8}>
          {marker}
        </g>
        {marker}
      </svg>

      {showPhaseLabels ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            fontSize: height * LAYOUT.labelFontSize,
            fontWeight: 300,
            letterSpacing: "0.42em",
            // Letter-spacing pads the right-hand side; nudge back to centre.
            textIndent: "0.42em",
            color: COLORS.label,
            opacity: labelOpacity,
          }}
        >
          {PHASE_LABEL[phase]}
        </AbsoluteFill>
      ) : null}

      <Grain opacity={grainOpacity} />
    </AbsoluteFill>
  );
};
