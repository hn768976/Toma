import React from "react";
import { AbsoluteFill } from "remotion";
import { HEIGHT, PERSPECTIVE, ROTATE_X, ROTATE_Z, WIDTH } from "./constants";
import { WorldMap } from "./map/WorldMap";
import type { Theme } from "./theme";

const MAP_PLANE_WIDTH = 6600;
const MAP_PLANE_HEIGHT = 3300;
/** Pushed back behind the board so it reads as a separate, further surface. */
const MAP_PUSH_BACK = 520;

export const Backdrop: React.FC<{
  theme: Theme;
  frame: number;
  frameWidth: number;
}> = ({ theme, frame, frameWidth }) => (
  <AbsoluteFill>
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 90% at 46% 38%, ${theme.backgroundFrom} 0%, ${theme.backgroundTo} 72%)`,
      }}
    />
    {/* A faint flat grid sits behind the map, not on it. */}
    <AbsoluteFill
      style={{
        backgroundImage: `repeating-linear-gradient(to right, ${theme.gridLine} 0 2px, transparent 2px 120px), repeating-linear-gradient(to bottom, ${theme.gridLine} 0 2px, transparent 2px 120px)`,
      }}
    />
    <div
      style={{
        position: "absolute",
        width: WIDTH,
        height: HEIGHT,
        perspective: PERSPECTIVE,
        perspectiveOrigin: "50% 50%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: (WIDTH - MAP_PLANE_WIDTH) / 2,
          top: (HEIGHT - MAP_PLANE_HEIGHT) / 2,
          width: MAP_PLANE_WIDTH,
          height: MAP_PLANE_HEIGHT,
          transform: `translateZ(${-MAP_PUSH_BACK}px) rotateZ(${ROTATE_Z}deg) rotateX(${ROTATE_X}deg)`,
          // The map never scrolls; it only ever softens.
          filter: `blur(${(frameWidth * 0.0042).toFixed(2)}px)`,
        }}
      >
        <WorldMap
          theme={theme}
          frame={frame}
          width={MAP_PLANE_WIDTH}
          height={MAP_PLANE_HEIGHT}
        />
      </div>
    </div>
  </AbsoluteFill>
);
