import { Composition } from "remotion";
import { HydrationReference, HydrationCameraMove } from "./Hydration";

// 226 frames @ 30 fps = 7.5333 s, identical to the reference clip.
export const DURATION_IN_FRAMES = 226;
export const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SkinHydration-V1-Reference-4K"
        component={HydrationReference}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="SkinHydration-V2-CameraMove-4K"
        component={HydrationCameraMove}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
      />
    </>
  );
};
