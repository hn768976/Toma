import React from "react";
import { useCurrentFrame } from "remotion";
import { BUILD_IN_FRAMES } from "../constants";
import { buildIn, smoothNoise } from "../motion";
import type { ChartProps } from "./types";

// Jagged, mountain-like blue signal that scrolls continuously (the spiky
// shapes in the reference's left-hand panels). Two layers for depth.
export const SignalArea: React.FC<ChartProps> = ({
  width,
  height,
  theme,
  delay,
  seed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const count = 64;
  const step = width / (count - 1);
  const reveal = buildIn(local, 0, BUILD_IN_FRAMES);

  const layer = (s: number, speed: number, amp: number, base: number) => {
    const pts: string[] = [];
    for (let i = 0; i < count; i++) {
      const x = i * 0.35 + frame * speed;
      const n =
        smoothNoise(s, x) * 0.6 + smoothNoise(s + 3, x * 3.1) * 0.4;
      const y = height * (base - n * amp * reveal);
      pts.push(`${i * step} ${y}`);
    }
    return `M 0 ${height} L ${pts.join(" L ")} L ${width} ${height} Z`;
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={layer(seed, 0.02, 0.75, 0.95)} fill={theme.accent} opacity={0.35} />
      <path d={layer(seed + 7, 0.03, 0.55, 0.95)} fill={theme.accent} opacity={0.75} />
      <path
        d={layer(seed + 7, 0.03, 0.55, 0.95)}
        fill="none"
        stroke={theme.accentAlt}
        strokeWidth={1.5}
        opacity={0.9}
      />
    </svg>
  );
};
