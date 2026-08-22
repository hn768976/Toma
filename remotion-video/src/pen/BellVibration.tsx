// The vibration lines beside the scene-6 bell. Redrawn every 4 frames, from
// the moment the bell appears to the final frame, without a single pause.

import React from "react";
import { RED, STROKE_WIDTH } from "./constants";
import { FINAL_BELL } from "./content";
import { arcPath, toD } from "./geometry";
import { shakeAt } from "./Ink";

/** Four arc sets, cycled one per tick, so the shake never repeats twice running. */
const VARIANTS = [
  [104, 138],
  [116, 152],
  [98, 130],
  [122, 146],
];

export const BellVibration: React.FC<{ frame: number; from: number }> = ({
  frame,
  from,
}) => {
  if (frame < from) return null;

  const tick = Math.floor(frame / 4);
  const radii = VARIANTS[tick % VARIANTS.length];
  const [sx, sy] = shakeAt(frame);
  const { x, y } = FINAL_BELL;

  return (
    <g
      transform={`translate(${sx} ${sy})`}
      stroke={RED}
      strokeWidth={STROKE_WIDTH}
      fill="none"
      strokeLinecap="round"
    >
      {radii.map((radius, i) =>
        [1, -1].map((side) => {
          const spread = 34 + i * 6;
          const centre = side === 1 ? 0 : 180;
          return (
            <path
              key={`${radius}-${side}`}
              d={toD(
                arcPath(x, y, radius, centre - spread / 2, spread, tick + i * 3 + side),
              )}
            />
          );
        }),
      )}
    </g>
  );
};
