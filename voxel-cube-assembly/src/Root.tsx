import { Composition } from "remotion";
import { VoxelCube } from "./VoxelCube";

// Reference clip: 20.000 s. At 30 fps that is exactly 600 frames.
const FPS = 30;
const DURATION_IN_FRAMES = 600;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 – faithful match of the reference (static studio camera) */}
      <Composition
        id="VoxelCube-V1-4K"
        component={VoxelCube}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" as const }}
      />
      {/* Version 2 – same scene, alternative camera: orbiting dolly-in */}
      <Composition
        id="VoxelCube-V2-4K"
        component={VoxelCube}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
