import React from "react";
import { BASE_W, DOTS } from "./constants";
import { useTheme } from "./theme";

export type DotStripProps = {
  /** Which side of the board; the right strip is mirrored. */
  side: "left" | "right";
  /** 0..1 build-in, staggered across the dots. */
  reveal: number;
  /** 0..1 fill level. Dots light up from the inner end outward. */
  level: number;
};

/**
 * Throughput meter: a row of dots that fills from the centre of the board
 * outward, like a signal-strength bar. The level bounces continuously, so the
 * strips read as live traffic rather than a static score.
 */
export const DotStrip: React.FC<DotStripProps> = ({ side, reveal, level }) => {
  const theme = useTheme();
  const { count, diameter, pitch, innerEnd, y } = DOTS;
  const r = diameter / 2;

  // Lit length in dots, with a soft leading dot at the boundary.
  const filled = Math.max(0, Math.min(count, level * count));

  const dots = Array.from({ length: count }, (_, i) => {
    // i = 0 is the innermost dot, nearest the centre of the board.
    const offset = innerEnd - i * pitch;
    const x = side === "left" ? offset : BASE_W - offset;
    const appear = Math.min(1, Math.max(0, reveal * (count + 4) - i * 0.7));
    const lit = Math.min(1, Math.max(0, filled - i));
    return { x, appear, lit, key: i };
  });

  return (
    <g>
      {dots.map((d) => (
        <circle
          key={d.key}
          cx={d.x}
          cy={y}
          r={r}
          fill={theme.dim}
          opacity={d.appear}
        />
      ))}
      {dots
        .filter((d) => d.lit > 0.01)
        .map((d) => (
          <circle
            key={`lit-${d.key}`}
            cx={d.x}
            cy={y}
            r={r}
            fill={theme.accent}
            opacity={d.appear * d.lit}
          />
        ))}
    </g>
  );
};
