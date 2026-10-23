import React from "react";
import { Composition } from "remotion";
import {
  DEEP_RAYS_FRAMES,
  FPS,
  HEIGHT,
  SURFACE_RAYS_FRAMES,
  WIDTH,
} from "./constants";
import { DeepRays } from "./DeepRays";
import { SurfaceRays } from "./SurfaceRays";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Composition 1: deep-ocean light rays */}
      <Composition
        id="Comp1-DeepRays-V1-Match"
        component={DeepRays}
        durationInFrames={DEEP_RAYS_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "locked" as const }}
      />
      <Composition
        id="Comp1-DeepRays-V2-CameraMove"
        component={DeepRays}
        durationInFrames={DEEP_RAYS_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "tiltReveal" as const }}
      />
      {/* Composition 2: shallow water seen from below the surface */}
      <Composition
        id="Comp2-SurfaceRays-V1-Match"
        component={SurfaceRays}
        durationInFrames={SURFACE_RAYS_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "ocean" as const }}
      />
      <Composition
        id="Comp2-SurfaceRays-V2-GoldenHour"
        component={SurfaceRays}
        durationInFrames={SURFACE_RAYS_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "goldenHour" as const }}
      />
    </>
  );
};
