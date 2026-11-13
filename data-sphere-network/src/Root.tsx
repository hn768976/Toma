import { Composition, Folder } from "remotion";
import { DataSphereNetwork } from "./DataSphereNetwork";

// Authored at native 4K UHD. Delivery renders use `--scale=0.5` -> 1920x1080.
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION = 402; // 13.4 s – identical to the reference clip

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Data-Sphere-Network">
      <Composition
        id="V1-Data-Sphere-Network-Dive"
        component={DataSphereNetwork}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "dolly" as const }}
      />
      <Composition
        id="V2-Data-Sphere-Network-Corkscrew"
        component={DataSphereNetwork}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "corkscrew" as const }}
      />
    </Folder>
  );
};
