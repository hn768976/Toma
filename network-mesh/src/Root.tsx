import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { NetworkMesh } from "./NetworkMesh";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MeshPlexusBlue"
        component={NetworkMesh}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "plexusBlue" as const }}
      />
      <Composition
        id="MeshLoopCheck"
        component={NetworkMesh}
        durationInFrames={DURATION_IN_FRAMES + 1}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "plexusBlue" as const }}
      />
    </>
  );
};
