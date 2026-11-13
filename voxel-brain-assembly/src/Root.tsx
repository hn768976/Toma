import { Composition } from "remotion";
import { VoxelBrain } from "./brain/VoxelBrain";

/**
 * Voxel Brain Assembly — two 4K (3840x2160) compositions at 30 fps.
 * Duration: 301 frames = 10.033 s, identical to the reference clip.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 301;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VoxelBrainAssembly-V1-Match"
        component={VoxelBrain}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "match" as const }}
      />
      <Composition
        id="VoxelBrainAssembly-V2-OrbitCamera"
        component={VoxelBrain}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "orbit" as const }}
      />
    </>
  );
};
