import { Composition } from "remotion";
import { PlasmaOrb } from "./orb/PlasmaOrb";

// 4K masters. 450 frames @ 30 fps = the reference's 450-frame length.
const common = {
  component: PlasmaOrb,
  durationInFrames: 450,
  fps: 30,
  width: 3840,
  height: 2160,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="PlasmaOrb-V1" {...common} defaultProps={{ variant: "v1" as const }} />
      <Composition id="PlasmaOrb-V2" {...common} defaultProps={{ variant: "v2" as const }} />
    </>
  );
};
