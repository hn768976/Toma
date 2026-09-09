import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION_IN_FRAMES } from "../constants";

const TAU = Math.PI * 2;

/**
 * Deep navy, darkest into the corners, with a soft blue glow seating the card.
 *
 * That is the whole background — there are no shapes in it. Both the drifting
 * bokeh and the out-of-focus periodic-table squares were removed on review;
 * don't reintroduce either.
 */
export const NeonBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  // t goes 0 -> 1 across the loop. The only animated value here is a sine of
  // TAU * t, so frame 300 lands exactly back on frame 0.
  const t = frame / DURATION_IN_FRAMES;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 62% 68% at 50% 48%, #0d1b38 0%, #08122a 42%, #060c1e 70%, #03060f 100%)`,
      }}
    >
      {/* Glow behind the card position. Kept tight so it seats the card
          rather than washing the frame. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle ${height * 0.35}px at 50% 50%, rgba(58,168,255,${0.2 + Math.sin(TAU * t) * 0.025}) 0%, rgba(45,130,215,0.07) 48%, rgba(30,90,180,0) 74%)`,
        }}
      />
    </AbsoluteFill>
  );
};
