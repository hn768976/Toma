import React from "react";
import { useCurrentFrame } from "remotion";
import { mulberry32 } from "../random";

export type MarkerStackProps = {
  x: number;
  y: number;
  count?: number;
  direction?: "up" | "down";
  color: string;
  size?: number;
  spacing?: number;
  seed: number;
  // Frames between one marker lighting up and the next.
  cadence?: number;
  startAt?: number;
};

// The little triangle ladders scattered through every reference frame.
// They pulse in sequence, which is what keeps the wide empty areas of
// the screen feeling alive between the slower chart animations.
export const MarkerStack: React.FC<MarkerStackProps> = ({
  x,
  y,
  count = 3,
  direction = "up",
  color,
  size = 16,
  spacing = 30,
  seed,
  cadence = 12,
  startAt = 0,
}) => {
  const frame = useCurrentFrame();
  const rand = mulberry32(seed * 6151 + 31);
  const offset = rand() * 40;

  return (
    <g fill={color}>
      {Array.from({ length: count }, (_, i) => {
        const cycle =
          (frame - startAt - offset - i * cadence) / (cadence * count * 1.6);
        const wave = Math.sin(cycle * Math.PI * 2);
        const opacity = frame < startAt ? 0 : 0.28 + Math.max(0, wave) * 0.62;
        const cy = y + i * spacing;
        const half = size / 2;
        const points =
          direction === "up"
            ? `${x},${cy - half} ${x - half},${cy + half} ${x + half},${cy + half}`
            : `${x},${cy + half} ${x - half},${cy - half} ${x + half},${cy - half}`;
        return <polygon key={i} points={points} opacity={opacity} />;
      })}
    </g>
  );
};
