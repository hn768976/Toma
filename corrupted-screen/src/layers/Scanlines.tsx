import React from "react";
import { DURATION_IN_FRAMES } from "../lib/timing";
import { Theme, withAlpha } from "../lib/theme";

/**
 * Layer 5: fine horizontal lines over everything, plus a brighter roll bar
 * drifting down the frame. Both live inside the screen plane, so they take the
 * same angle as the corruption.
 */

type Props = {
  theme: Theme;
  planeWidth: number;
  planeHeight: number;
  frame: number;
  level: number;
};

/** Line pitch in plane pixels at the 3840 wide master. */
const PITCH_RATIO = 12 / 3840;
/**
 * The scanlines walk down exactly one pitch every DRIFT_CYCLE frames. 20
 * divides 600, so the pattern is back where it started at the loop point -
 * derived from an integer frame count rather than a float step, which would
 * only land on zero to within rounding error.
 */
const DRIFT_CYCLE = 20;

const ROLL_CYCLES = 3;

export const Scanlines: React.FC<Props> = ({ theme, planeWidth, planeHeight, frame, level }) => {
  const pitch = planeWidth * PITCH_RATIO;
  const drift = ((frame % DRIFT_CYCLE) / DRIFT_CYCLE) * pitch;

  const rollHeight = planeHeight * 0.17;
  const rollProgress = ((frame / DURATION_IN_FRAMES) * ROLL_CYCLES) % 1;
  const rollY = rollProgress * (planeHeight + rollHeight) - rollHeight;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -pitch,
          width: planeWidth,
          height: planeHeight + pitch * 2,
          transform: `translateY(${drift}px)`,
          backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0.13) 0px, rgba(0,0,0,0.13) ${(
            pitch * 0.5
          ).toFixed(2)}px, rgba(0,0,0,0) ${(pitch * 0.5).toFixed(2)}px, rgba(0,0,0,0) ${pitch.toFixed(
            2,
          )}px)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: rollY,
          width: planeWidth,
          height: rollHeight,
          background: `linear-gradient(to bottom, rgba(255,255,255,0) 0%, ${withAlpha(
            theme.rollBar,
            0.05,
          )} 45%, ${withAlpha(theme.rollBar, 0.11 + level * 0.05)} 62%, rgba(255,255,255,0) 100%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
    </>
  );
};
