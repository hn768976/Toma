import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  CAMERA_PERSPECTIVE,
  CAMERA_ROTATE_Z,
  CAMERA_TILT_X,
  DURATION_IN_FRAMES,
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  GRID_CELL,
  GRID_CELL_MAJOR,
} from "./constants";
import { BOARD_HEIGHT, BOARD_WIDTH, PANELS } from "./layout";
import { Panel } from "./Panel";
import type { Theme } from "./themes";

type Props = { theme: Theme };

const easeInOut = Easing.inOut(Easing.sin);

// The tilted floor with its grid and all the panels, plus the slow camera
// drift that runs for the whole clip.
export const Board: React.FC<Props> = ({ theme }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, DURATION_IN_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeInOut,
  });

  // Camera drift: pan across the board, creep in a little, and un-twist by
  // a couple of degrees. Values in floor px / degrees.
  const panX = interpolate(t, [0, 1], [-70, 130]);
  const panY = interpolate(t, [0, 1], [30, -40]);
  const zoom = interpolate(t, [0, 1], [1.0, 1.07]);
  const rotZ = interpolate(t, [0, 1], [CAMERA_ROTATE_Z, CAMERA_ROTATE_Z + 3]);
  const tiltX = interpolate(t, [0, 1], [CAMERA_TILT_X, CAMERA_TILT_X - 2]);

  // Where the panel board sits on the floor: pushed toward the top-left so
  // the framed rows fall into the viewport once tilted.
  const boardLeft = (FLOOR_WIDTH - BOARD_WIDTH) / 2 - 60;
  const boardTop = (FLOOR_HEIGHT - BOARD_HEIGHT) / 2 - 330;

  return (
    <AbsoluteFill
      style={{
        perspective: CAMERA_PERSPECTIVE,
        perspectiveOrigin: "50% 42%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: FLOOR_WIDTH,
          height: FLOOR_HEIGHT,
          marginLeft: -FLOOR_WIDTH / 2,
          marginTop: -FLOOR_HEIGHT / 2,
          transformStyle: "preserve-3d",
          transform: `translate3d(0px, 120px, 0px) scale(${zoom}) rotateX(${tiltX}deg) rotateZ(${rotZ}deg) translate(${panX}px, ${panY}px)`,
          background: theme.floorFill,
          backgroundImage: [
            `linear-gradient(${theme.gridLineMajor} 1.5px, transparent 1.5px)`,
            `linear-gradient(90deg, ${theme.gridLineMajor} 1.5px, transparent 1.5px)`,
            `linear-gradient(${theme.gridLine} 1px, transparent 1px)`,
            `linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px)`,
          ].join(", "),
          backgroundSize: [
            `${GRID_CELL_MAJOR}px ${GRID_CELL_MAJOR}px`,
            `${GRID_CELL_MAJOR}px ${GRID_CELL_MAJOR}px`,
            `${GRID_CELL}px ${GRID_CELL}px`,
            `${GRID_CELL}px ${GRID_CELL}px`,
          ].join(", "),
          maskImage:
            "radial-gradient(ellipse 50% 50% at 50% 50%, black 50%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 50% 50% at 50% 50%, black 50%, transparent 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: boardLeft,
            top: boardTop,
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
          }}
        >
          {PANELS.map((spec) => (
            <Panel key={`${spec.row}-${spec.col}`} spec={spec} theme={theme} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
