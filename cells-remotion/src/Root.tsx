import React from "react";
import { Composition } from "remotion";
import { CellField } from "./cells/CellField";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./cells/variants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CellsRed"
        component={CellField}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "red" as const }}
      />
      <Composition
        id="CellsBlue"
        component={CellField}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
    </>
  );
};
