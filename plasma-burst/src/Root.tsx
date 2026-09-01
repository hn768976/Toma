import { Composition } from "remotion";
import { TIMING } from "./plasma/config";
import { PlasmaBurst } from "./plasma/PlasmaBurst";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PlasmaBurst"
    component={PlasmaBurst}
    durationInFrames={TIMING.durationInFrames}
    fps={TIMING.fps}
    width={3840}
    height={2160}
    defaultProps={{ variant: "blue" as const }}
  />
);
