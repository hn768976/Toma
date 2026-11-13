import { Composition } from "remotion";
import { ColonoscopyPolypDetection } from "./ColonoscopyPolypDetection";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 - matches the reference: locked-off cutaway view */}
      <Composition
        id="ColonoscopyPolypDetection-V1-Reference"
        component={ColonoscopyPolypDetection}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "reference" as const }}
      />
      {/* Version 2 - alternative camera angle + movement (orbiting push-in) */}
      <Composition
        id="ColonoscopyPolypDetection-V2-OrbitCamera"
        component={ColonoscopyPolypDetection}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "orbit" as const }}
      />
    </>
  );
};
