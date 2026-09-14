import React from "react";
import { useCurrentFrame } from "remotion";
import { revealAt } from "../animation";
import { mulberry32 } from "../random";

export type HistogramProps = {
  x: number;
  // Baseline the bars stand on.
  baseline: number;
  width: number;
  maxHeight: number;
  count: number;
  seed: number;
  colors: string[];
  gap?: number;
  drawStart?: number;
  // Total time for the whole sweep; each bar gets a slice of it, left
  // to right, so the histogram wipes in rather than popping.
  drawDuration?: number;
  opacity?: number;
  // Slow vertical breathing once the bars have landed.
  liveliness?: number;
};

export const Histogram: React.FC<HistogramProps> = ({
  x,
  baseline,
  width,
  maxHeight,
  count,
  seed,
  colors,
  gap = 0.28,
  drawStart = 0,
  drawDuration = 120,
  opacity = 1,
  liveliness = 0.06,
}) => {
  const frame = useCurrentFrame();
  const slot = width / count;
  const barWidth = slot * (1 - gap);
  const rand = mulberry32(seed * 3671 + 5);

  // Bar heights are a random walk too, so neighbouring bars relate the
  // way a real time series does instead of looking like white noise.
  let level = 0.45;
  const bars = Array.from({ length: count }, (_, i) => {
    level += (rand() - 0.48) * 0.22;
    level = Math.min(0.98, Math.max(0.12, level));
    const envelope = 0.55 + 0.45 * Math.sin((i / count) * Math.PI * 1.7);
    return {
      height: level * envelope,
      color: colors[i % colors.length],
      phase: rand() * Math.PI * 2,
    };
  });

  const perBar = drawDuration / (count + 18);

  return (
    <g opacity={opacity}>
      {bars.map((bar, i) => {
        const start = drawStart + i * perBar;
        const grow = revealAt(frame, start, perBar * 16);
        if (grow <= 0) {
          return null;
        }
        const breathe =
          1 + Math.sin(frame * 0.09 + bar.phase) * liveliness * grow;
        const h = bar.height * maxHeight * grow * breathe;
        return (
          <rect
            key={i}
            x={x + i * slot + (slot - barWidth) / 2}
            y={baseline - h}
            width={barWidth}
            height={h}
            fill={bar.color}
            opacity={0.88}
          />
        );
      })}
    </g>
  );
};
