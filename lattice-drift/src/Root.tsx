import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  REFERENCE_PALETTE,
  WIDTH,
} from "./lattice/constants";
import { LatticeDrift, LatticeDriftProps } from "./lattice/LatticeDrift";

// Both compositions are authored at 4K UHD (3840x2160), 30 fps, 270 frames
// (= 9.0 s, the reference length at 30 fps).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LatticeDrift-V1-Reference"
        component={LatticeDrift}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={
          {
            variant: "reference",
            palette: REFERENCE_PALETTE,
            seed: 7,
          } satisfies LatticeDriftProps
        }
      />
      <Composition
        id="LatticeDrift-V2-Crane"
        component={LatticeDrift}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={
          {
            variant: "crane",
            palette: REFERENCE_PALETTE,
            seed: 7,
          } satisfies LatticeDriftProps
        }
      />
    </>
  );
};
