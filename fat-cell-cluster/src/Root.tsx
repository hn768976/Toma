/**
 * Adipocyte cluster compositions.
 *
 * Nine compositions across four looks, all 300 frames at 30fps (10 seconds),
 * 16:9, defined at 3840x2160. Looks 1, 2 and 4 are seamless loops. Look 3 is
 * deliberately not a loop and must not be keyworded as one — the one-way
 * shrink is the point of it.
 *
 * Adding a look means adding a row to `src/fatcells/looks.ts`; this file needs
 * no change.
 */

import React from "react";
import { Composition } from "remotion";
import { FatCellComposition } from "./FatCellComposition";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./fatcells/constants";
import { LOOKS } from "./fatcells/looks";

/**
 * Raise this to 301 and re-render frames 0 and 300 to check a loop closes.
 * Look 3 is exempt: it is deliberately not a loop.
 */
export const DURATION_IN_FRAMES = LOOP_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    {LOOKS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={FatCellComposition}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ row }}
      />
    ))}
  </>
);
