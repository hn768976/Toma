import React from "react";

export type ScreenGridProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  cell?: number;
  majorEvery?: number;
  color?: string;
  majorColor?: string;
  strokeWidth?: number;
};

// The graph paper every version sits on: a fine cell grid with a heavier
// line every few cells. Drawn as explicit lines rather than a <pattern>
// so the major/minor split stays phase-locked to the layout.
export const ScreenGrid: React.FC<ScreenGridProps> = ({
  x,
  y,
  width,
  height,
  cell = 48,
  majorEvery = 5,
  color = "rgba(120, 170, 235, 0.13)",
  majorColor = "rgba(130, 185, 250, 0.3)",
  strokeWidth = 1.4,
}) => {
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);

  return (
    <g>
      {Array.from({ length: cols + 1 }, (_, i) => {
        const lineX = x + i * cell;
        const major = i % majorEvery === 0;
        return (
          <line
            key={`v${i}`}
            x1={lineX}
            y1={y}
            x2={lineX}
            y2={y + height}
            stroke={major ? majorColor : color}
            strokeWidth={major ? strokeWidth * 1.3 : strokeWidth}
          />
        );
      })}
      {Array.from({ length: rows + 1 }, (_, i) => {
        const lineY = y + i * cell;
        const major = i % majorEvery === 0;
        return (
          <line
            key={`h${i}`}
            x1={x}
            y1={lineY}
            x2={x + width}
            y2={lineY}
            stroke={major ? majorColor : color}
            strokeWidth={major ? strokeWidth * 1.3 : strokeWidth}
          />
        );
      })}
    </g>
  );
};
