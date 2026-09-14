import React from "react";
import { RALLY, RALLY_LADDER, STAGE_HEIGHT } from "./constants";
import { formatLadder } from "./palette";

// The left-hand scale in V2: a cyan spine with a numbered rung every
// LADDER_GAP world units and four unlabelled ticks between them.
//
// The rungs are evenly spaced regardless of the arithmetic gaps between
// their values (10, 20, 50, 75, 100, ...) — a stylised quasi-log scale,
// exactly like the reference plate.
export const RallyLadder: React.FC<{
  /** world -> screen mapping supplied by the scene's camera. */
  toScreenX: (worldX: number) => number;
  toScreenY: (worldY: number) => number;
  zoom: number;
  fontFamily: string;
  labelColor: string;
}> = ({ toScreenX, toScreenY, zoom, fontFamily, labelColor }) => {
  const spineX = toScreenX(RALLY.axisWorldX);
  const spineWidth = Math.max(2, 11 * zoom);
  const minorGap = RALLY.ladderGap / 5;

  const nodes: React.ReactNode[] = [];

  for (let rung = 0; rung < RALLY_LADDER.length; rung++) {
    const y = toScreenY(-rung * RALLY.ladderGap);
    if (y < -200 || y > STAGE_HEIGHT + 200) continue;

    nodes.push(
      <div
        key={`t${rung}`}
        style={{
          position: "absolute",
          left: spineX,
          top: y - 3 * zoom,
          width: 46 * zoom,
          height: 6 * zoom,
          background: RALLY.axis,
        }}
      />,
      <div
        key={`l${rung}`}
        style={{
          position: "absolute",
          // Right-aligned into the gutter left of the spine.
          left: spineX - 34 * zoom - 700 * zoom,
          top: y - 44 * zoom,
          width: 700 * zoom,
          textAlign: "right",
          fontFamily,
          fontSize: 66 * zoom,
          fontWeight: 700,
          color: labelColor,
          textShadow: `0 0 ${22 * zoom}px ${labelColor}`,
          whiteSpace: "nowrap",
        }}
      >
        {formatLadder(RALLY_LADDER[rung])}
      </div>,
    );
  }

  // Minor ticks run the full height of the ladder, including past the
  // top and bottom rungs so the spine never looks truncated.
  for (let minor = -14; minor < RALLY_LADDER.length * 5 + 14; minor++) {
    if (minor % 5 === 0) continue;
    const y = toScreenY(-minor * minorGap);
    if (y < -80 || y > STAGE_HEIGHT + 80) continue;
    nodes.push(
      <div
        key={`m${minor}`}
        style={{
          position: "absolute",
          left: spineX,
          top: y - 2 * zoom,
          width: 24 * zoom,
          height: 4 * zoom,
          background: RALLY.axis,
          opacity: 0.75,
        }}
      />,
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: spineX - spineWidth / 2,
          top: -200,
          width: spineWidth,
          height: STAGE_HEIGHT + 400,
          background: RALLY.axis,
          boxShadow: `0 0 ${30 * zoom}px rgba(63, 195, 245, 0.55)`,
        }}
      />
      {nodes}
    </div>
  );
};
