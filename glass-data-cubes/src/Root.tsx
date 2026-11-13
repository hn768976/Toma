import { Composition } from "remotion";
import { GlassDataCubes, glassDataCubesSchema } from "./GlassDataCubes";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./scene/constants";

// Two 4K (3840x2160) master compositions, 30 fps, 500 frames (16.667 s).
//  - Version 1 matches the reference (white void, smoky grey glass).
//  - Version 2 keeps the scene and camera but re-grades it as a dark
//    holographic blueprint (navy / cyan / amber).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GlassDataCubes-V1-Reference"
        component={GlassDataCubes}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        schema={glassDataCubesSchema}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="GlassDataCubes-V2-Blueprint"
        component={GlassDataCubes}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        schema={glassDataCubesSchema}
        defaultProps={{ variant: "blueprint" as const }}
      />
    </>
  );
};
