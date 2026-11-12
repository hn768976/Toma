import React from "react";
import { Composition } from "remotion";
import { FiberStreams } from "./fibers/FiberStreams";

// Both compositions are authored at 4K UHD (3840x2160), 30 fps.
// Reference clip length: 15.7 s = 471 frames @ 30 fps.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Fiber-Optic-Light-Streams-V1-Reference"
      component={FiberStreams}
      fps={30}
      durationInFrames={471}
      width={3840}
      height={2160}
      defaultProps={{ variant: "v1" as const }}
    />
    <Composition
      id="Fiber-Optic-Light-Streams-V2-Aurora-Palette"
      component={FiberStreams}
      fps={30}
      durationInFrames={471}
      width={3840}
      height={2160}
      defaultProps={{ variant: "v2" as const }}
    />
  </>
);
