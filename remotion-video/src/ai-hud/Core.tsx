import React from "react";
import { useCurrentFrame } from "remotion";
import { CORE_R, CORE_X, CORE_Y, FONT_SANS, PALETTE } from "./constants";
import { cwave, spin } from "./loop";

// ---------------------------------------------------------------------------
// The central core.
//
// Concentric rings turn at different INTEGER revolution counts and in
// opposite directions; the scanning arc sweeps its own ring. The globe
// meridians are ellipses whose x-radius is driven by a cosine, which reads as
// a sphere turning without needing any 3D at all.
// ---------------------------------------------------------------------------

const R = CORE_R;

/** Evenly spaced tick marks around a ring. Pure function of the index. */
const Ticks: React.FC<{
  radius: number;
  count: number;
  len: number;
  width: number;
  color: string;
  opacity: number;
  skip?: (i: number) => boolean;
}> = ({ radius, count, len, width, color, opacity, skip }) => (
  <g stroke={color} strokeWidth={width} opacity={opacity}>
    {Array.from({ length: count }, (_, i) => {
      if (skip?.(i)) return null;
      const a = (i / count) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return (
        <line
          key={i}
          x1={CORE_X + c * radius}
          y1={CORE_Y + s * radius}
          x2={CORE_X + c * (radius + len)}
          y2={CORE_Y + s * (radius + len)}
        />
      );
    })}
  </g>
);

/** A dashed ring built from arc segments with gaps, for the rotating rings. */
const GappedRing: React.FC<{
  radius: number;
  width: number;
  color: string;
  opacity: number;
  segments: [number, number][];
}> = ({ radius, width, color, opacity, segments }) => (
  <g fill="none" stroke={color} strokeWidth={width} opacity={opacity}>
    {segments.map(([from, to], i) => {
      const a0 = (from * Math.PI) / 180;
      const a1 = (to * Math.PI) / 180;
      const large = to - from > 180 ? 1 : 0;
      return (
        <path
          key={i}
          d={`M ${CORE_X + Math.cos(a0) * radius} ${CORE_Y + Math.sin(a0) * radius} A ${radius} ${radius} 0 ${large} 1 ${CORE_X + Math.cos(a1) * radius} ${CORE_Y + Math.sin(a1) * radius}`}
        />
      );
    })}
  </g>
);

export const Core: React.FC = () => {
  const frame = useCurrentFrame();

  // Integer revolution counts, two of them in the opposite direction.
  const ringA = spin(frame, 2);
  const ringB = spin(frame, -3);
  const ringC = spin(frame, 1);
  const scan = spin(frame, 4);

  const meridians = [0, 1, 2, 3, 4, 5].map((k) => {
    const rx = Math.abs(cwave(frame, 2, k / 12)) * R * 0.94;
    return Math.max(1.2, rx);
  });

  return (
    <g filter="url(#glowCore)">
      {/* The wide faint ripple the hub sits in — barely visible, but it is
          what keeps the core from looking pasted onto the background. */}
      <circle cx={CORE_X} cy={CORE_Y} r={R * 2.62} fill="url(#coreMassGrad)" opacity={0.09} />

      {/* Outermost containment ring — very faint, sets the scale of the hub. */}
      <circle
        cx={CORE_X}
        cy={CORE_Y}
        r={R * 2.34}
        fill="none"
        stroke={PALETTE.cyanDim}
        strokeWidth={3.6}
        opacity={0.26}
      />
      <circle
        cx={CORE_X}
        cy={CORE_Y}
        r={R * 1.96}
        fill="none"
        stroke={PALETTE.cyanDim}
        strokeWidth={3}
        opacity={0.18}
      />

      {/* A ring of small dots, counter-rotating with ring B. */}
      <g transform={`rotate(${ringB} ${CORE_X} ${CORE_Y})`}>
        {Array.from({ length: 56 }, (_, i) => {
          const a = (i / 56) * Math.PI * 2;
          return (
            <circle
              key={i}
              cx={CORE_X + Math.cos(a) * R * 2.06}
              cy={CORE_Y + Math.sin(a) * R * 2.06}
              r={i % 7 === 0 ? 5.5 : 3.2}
              fill={PALETTE.cyan}
              opacity={i % 7 === 0 ? 0.72 : 0.42}
            />
          );
        })}
      </g>

      {/* Ring A: ticked, turns clockwise. */}
      <g transform={`rotate(${ringA} ${CORE_X} ${CORE_Y})`}>
        <circle
          cx={CORE_X}
          cy={CORE_Y}
          r={R * 1.6}
          fill="none"
          stroke={PALETTE.cyanDim}
          strokeWidth={3.6}
          opacity={0.52}
        />
        <Ticks
          radius={R * 1.6}
          count={72}
          len={R * 0.07}
          width={3}
          color={PALETTE.cyan}
          opacity={0.46}
          skip={(i) => i % 6 === 0}
        />
        <Ticks
          radius={R * 1.6}
          count={12}
          len={R * 0.15}
          width={4}
          color={PALETTE.cyan}
          opacity={0.5}
        />
      </g>

      {/* The scanning arc, sweeping ring A's radius four times over the loop. */}
      <g transform={`rotate(${scan} ${CORE_X} ${CORE_Y})`}>
        <path
          d={`M ${CORE_X + Math.cos(-0.34) * R * 1.6} ${CORE_Y + Math.sin(-0.34) * R * 1.6} A ${R * 1.6} ${R * 1.6} 0 0 1 ${CORE_X + Math.cos(0.34) * R * 1.6} ${CORE_Y + Math.sin(0.34) * R * 1.6}`}
          fill="none"
          stroke="#9BEDFF"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.7}
        />
      </g>

      {/* Ring B: gapped, turns anticlockwise. */}
      <g transform={`rotate(${ringB} ${CORE_X} ${CORE_Y})`}>
        <GappedRing
          radius={R * 1.4}
          width={4}
          color={PALETTE.cyan}
          opacity={0.56}
          segments={[
            [8, 78],
            [96, 166],
            [188, 244],
            [262, 352],
          ]}
        />
      </g>

      {/*
        The platform the disc sits on. Disc + platform have to read as ONE
        continuous luminous mass about 1.7x the disc radius — that is what
        gives the core its weight in frame.
      */}
      <circle cx={CORE_X} cy={CORE_Y} r={R * 1.72} fill="url(#coreMassGrad)" opacity={0.3} />
      <circle cx={CORE_X} cy={CORE_Y} r={R * 1.34} fill="url(#corePlatformGrad)" />
      <circle
        cx={CORE_X}
        cy={CORE_Y}
        r={R * 1.24}
        fill="none"
        stroke={PALETTE.cyanDeep}
        strokeWidth={R * 0.085}
        opacity={0.5}
      />

      {/* Ring C: tight ticked ring just outside the disc, clockwise. */}
      <g transform={`rotate(${ringC} ${CORE_X} ${CORE_Y})`}>
        <circle
          cx={CORE_X}
          cy={CORE_Y}
          r={R * 1.11}
          fill="none"
          stroke={PALETTE.cyan}
          strokeWidth={3.4}
          opacity={0.55}
        />
        <Ticks
          radius={R * 1.11}
          count={48}
          len={R * 0.05}
          width={3.2}
          color={PALETTE.cyan}
          opacity={0.45}
          skip={(i) => i % 4 === 0}
        />
      </g>

      {/* Bloom, then the disc on top of it. */}
      <circle cx={CORE_X} cy={CORE_Y} r={R * 1.46} fill="url(#coreBloomGrad)" />
      <circle cx={CORE_X} cy={CORE_Y} r={R} fill="url(#coreFillGrad)" />

      {/* Globe meridians and latitudes, clipped to the disc. */}
      <clipPath id="coreClip">
        <circle cx={CORE_X} cy={CORE_Y} r={R} />
      </clipPath>
      <g
        clipPath="url(#coreClip)"
        fill="none"
        stroke={PALETTE.coreInk}
        strokeWidth={2.8}
        opacity={0.26}
      >
        {meridians.map((rx, i) => (
          <ellipse key={i} cx={CORE_X} cy={CORE_Y} rx={rx} ry={R} />
        ))}
        {[-0.86, -0.64, -0.34, 0, 0.34, 0.64, 0.86].map((f, i) => (
          <line
            key={`lat${i}`}
            x1={CORE_X - R}
            y1={CORE_Y + R * f}
            x2={CORE_X + R}
            y2={CORE_Y + R * f}
          />
        ))}
        <circle cx={CORE_X} cy={CORE_Y} r={R * 0.995} strokeWidth={5} />
      </g>

      {/*
        The mark. Plain upright geometric sans, both letters capital — NOT a
        stylised or italic serif, which would read as an existing product's
        icon and is exactly the sort of resemblance that gets a clip pulled.
      */}
      <text
        x={CORE_X}
        y={CORE_Y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT_SANS}
        fontWeight={600}
        fontSize={R * 0.8}
        letterSpacing={R * 0.015}
        fill={PALETTE.coreInk}
        opacity={0.92}
      >
        AI
      </text>
    </g>
  );
};
