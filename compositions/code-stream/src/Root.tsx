import { Composition } from "remotion";
import { CodeStream, codeStreamSchema } from "./code-stream/CodeStream";

// 4K UHD masters. Deliverables are rendered with `--scale=0.5` (1920x1080).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 15.000 s @ 30 fps = 450 frames.
const DURATION = 450;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CodeStream-V1"
        component={CodeStream}
        schema={codeStreamSchema}
        defaultProps={{ variant: "v1" as const }}
        fps={FPS}
        durationInFrames={DURATION}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="CodeStream-V2"
        component={CodeStream}
        schema={codeStreamSchema}
        defaultProps={{ variant: "v2" as const }}
        fps={FPS}
        durationInFrames={DURATION}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
