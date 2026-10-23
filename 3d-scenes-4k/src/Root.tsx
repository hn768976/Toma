import { Composition } from "remotion";
import { BarrelField } from "./barrels/BarrelField";
import { VoxelCube } from "./voxel/VoxelCube";

// All compositions are authored at 4K UHD, 30 fps, 8.000 s (240 frames) to
// match the 8.000 s reference clips exactly.
const W = 3840;
const H = 2160;
const FPS = 30;
const FRAMES = 240;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BarrelField-V1"
        component={BarrelField}
        fps={FPS}
        durationInFrames={FRAMES}
        width={W}
        height={H}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="BarrelField-V2"
        component={BarrelField}
        fps={FPS}
        durationInFrames={FRAMES}
        width={W}
        height={H}
        defaultProps={{ variant: "v2" as const }}
      />
      <Composition
        id="VoxelCube-V1"
        component={VoxelCube}
        fps={FPS}
        durationInFrames={FRAMES}
        width={W}
        height={H}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="VoxelCube-V2"
        component={VoxelCube}
        fps={FPS}
        durationInFrames={FRAMES}
        width={W}
        height={H}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
