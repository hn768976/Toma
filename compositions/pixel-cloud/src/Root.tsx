import { Composition } from "remotion";
import { PixelCloud, pixelCloudSchema } from "./pixel-cloud/PixelCloud";

// 4K UHD masters. Deliverables are rendered with `--scale=0.5` (1920x1080).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
// Reference clip: 360 frames (12.012 s @ 29.97 fps). At exactly 30 fps the
// same 360 frames last 12.000 s, the closest whole-frame match.
const DURATION = 360;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PixelCloud-V1"
        component={PixelCloud}
        schema={pixelCloudSchema}
        defaultProps={{ camera: "locked" as const }}
        fps={FPS}
        durationInFrames={DURATION}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="PixelCloud-V2"
        component={PixelCloud}
        schema={pixelCloudSchema}
        defaultProps={{ camera: "orbit" as const }}
        fps={FPS}
        durationInFrames={DURATION}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
