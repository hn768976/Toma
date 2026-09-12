import React from "react";
import { PALETTE } from "./constants";

export type PerspectiveGridProps = {
  /** Size of the grid plane in design units - much larger than the board, so
   *  it still fills the frame after the camera tilts it away. */
  width: number;
  height: number;
  spacing: number;
  opacity: number;
};

/** Faint blueprint grid that sits on the same 3D plane as the board. */
export const PerspectiveGrid: React.FC<PerspectiveGridProps> = ({
  width,
  height,
  spacing,
  opacity,
}) => {
  const cols = Math.round(width / spacing);
  const rows = Math.round(height / spacing);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <g stroke={PALETTE.grid} strokeWidth={1} opacity={opacity}>
        {Array.from({ length: cols + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * spacing}
            y1={0}
            x2={i * spacing}
            y2={height}
          />
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * spacing}
            x2={width}
            y2={i * spacing}
          />
        ))}
      </g>
    </svg>
  );
};
