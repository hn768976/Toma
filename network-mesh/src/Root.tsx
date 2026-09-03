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
        id="MeshPlexusGreen"
        component={NetworkMesh}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "plexusGreen" as const }}
      />
      <Composition
        id="MeshFlareBlue"
        component={NetworkMesh}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "flareBlue" as const }}
      />
      <Composition
        id="MeshFlareAmber"
        component={NetworkMesh}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "flareAmber" as const }}
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
