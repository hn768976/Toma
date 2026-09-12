import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_SANS } from "./constants";

type Props = {
  size: number;
  color: string;
  /** Secondary hue for the outer orbit arcs. */
  accent: string;
  label?: string;
  /** CSS drop-shadow glow radius in px; 0 disables the glow. */
  glow?: number;
  strokeScale?: number;
};

// The circular "AI" mark: a solid containment ring, two counter-rotating
// arc orbits and a tick ring. Everything is drawn in a 200x200 viewBox and
// scaled by `size`, so it stays crisp at 4K.
export const AiEmblem: React.FC<Props> = ({
  size,
  color,
  accent,
  label = "AI",
  glow = 0,
  strokeScale = 1,
}) => {
  const frame = useCurrentFrame();

  // Two orbits at different speeds and opposite directions; the slower one
  // also breathes slightly so the mark never looks like a spinning GIF.
  const orbitA = frame * 0.9;
  const orbitB = -frame * 0.55;
  const breathe = 1 + 0.012 * Math.sin(frame * 0.07);

  const ringStroke = 2.4 * strokeScale;
  const arcStroke = 1.7 * strokeScale;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{
        overflow: "visible",
        filter: glow > 0 ? `drop-shadow(0 0 ${glow}px ${color})` : undefined,
      }}
    >
      <g transform={`translate(100 100) scale(${breathe}) translate(-100 -100)`}>
        {/* Containment ring */}
        <circle
          cx={100}
          cy={100}
          r={74}
          fill="none"
          stroke={color}
          strokeWidth={ringStroke}
          opacity={0.92}
        />

        {/* Outer orbit A — three unequal arcs */}
        <g transform={`rotate(${orbitA} 100 100)`}>
          <circle
            cx={100}
            cy={100}
            r={88}
            fill="none"
            stroke={accent}
            strokeWidth={arcStroke}
            strokeLinecap="round"
            strokeDasharray="120 44 52 44 26 267"
            opacity={0.75}
          />
        </g>

        {/* Outer orbit B — thinner, counter-rotating */}
        <g transform={`rotate(${orbitB} 100 100)`}>
          <circle
            cx={100}
            cy={100}
            r={94}
            fill="none"
            stroke={accent}
            strokeWidth={arcStroke * 0.7}
            strokeLinecap="round"
            strokeDasharray="30 250 90 220"
            opacity={0.5}
          />
        </g>

        {/* Inner tick ring */}
        <g transform={`rotate(${-orbitA * 0.35} 100 100)`}>
          <circle
            cx={100}
            cy={100}
            r={64}
            fill="none"
            stroke={color}
            strokeWidth={arcStroke * 0.8}
            strokeDasharray="2 12"
            opacity={0.42}
          />
        </g>

        <text
          x={100}
          y={100}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: 58,
            letterSpacing: 1,
          }}
        >
          {label}
        </text>
      </g>
    </svg>
  );
};
