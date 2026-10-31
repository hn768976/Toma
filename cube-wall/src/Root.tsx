import { Composition } from "remotion";
import {
  DURATION_IN_FRAMES,
  FPS,
  INDIGO_EMBER_PALETTE,
  HEIGHT,
  REFERENCE_PALETTE,
  WIDTH,
} from "./wall/constants";
import { CubeWall, CubeWallProps } from "./wall/CubeWall";

// Both compositions are authored at 4K UHD (3840x2160), 30 fps, 420 frames
// (= 14.0 s, exactly the reference length).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CubeWall-V1-Reference"
        component={CubeWall}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={
          { palette: REFERENCE_PALETTE, seed: 11 } satisfies CubeWallProps
        }
      />
      <Composition
        id="CubeWall-V2-IndigoEmber"
        component={CubeWall}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={
          { palette: INDIGO_EMBER_PALETTE, seed: 11 } satisfies CubeWallProps
        }
      />
    </>
  );
};
