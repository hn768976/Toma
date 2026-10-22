import "./index.css";
import { Composition } from "remotion";
import { HoloPortal } from "./portal/HoloPortal";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./portal/constants";

// Both compositions are authored at 4K (3840x2160). Deliverables are
// rendered at 1080p with `--scale=0.5` (see package.json scripts).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HoloPortal"
        component={HoloPortal}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMode: "reference" as const }}
      />
      <Composition
        id="HoloPortalOrbit"
        component={HoloPortal}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ cameraMode: "orbit" as const }}
      />
    </>
  );
};
