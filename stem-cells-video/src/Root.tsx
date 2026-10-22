import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { coralPalette, referencePalette } from "./palettes";
import { StemCells } from "./StemCells";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference clip (blue backlit microscopy). */}
      <Composition
        id="StemCells"
        component={StemCells}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: referencePalette }}
      />
      {/* Version 2: identical motion, alternate coral/violet palette. */}
      <Composition
        id="StemCellsCoral"
        component={StemCells}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: coralPalette }}
      />
    </>
  );
};
