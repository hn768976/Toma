import { Composition } from "remotion";
import { AIBrainPlane } from "./AIBrainPlane";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";

/**
 * Two versions of the same scene. They share every module — geometry, both
 * procedural textures, the camera path — and differ only in the palette.
 */
export const RemotionRoot: React.FC = () => {
  const shared = {
    component: AIBrainPlane,
    durationInFrames: DURATION_IN_FRAMES,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
  } as const;

  return (
    <>
      <Composition
        id="V1-AIBrainPlaneBlue"
        {...shared}
        defaultProps={{ themeId: "blue" }}
      />
      <Composition
        id="V2-AIBrainPlaneMono"
        {...shared}
        defaultProps={{ themeId: "mono" }}
      />
    </>
  );
};
