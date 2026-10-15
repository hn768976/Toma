import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, LOOP, WIDTH } from "./engine/constants";
import { PixiLoop, type PixiLoopProps } from "./engine/PixiLoop";
import { VERSIONS } from "./versions";

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={PixiLoop}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ look: v.look, params: v.params, loopCheck: false } as PixiLoopProps}
        // loopCheck=true makes the composition 601 frames so frame 600 can be
        // rendered and compared with frame 0 (verification only).
        calculateMetadata={({ props }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP })}
      />
    ))}
  </>
);
