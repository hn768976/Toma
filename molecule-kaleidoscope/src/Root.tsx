import "./index.css";
import { Composition } from "remotion";
import { MoleculeKaleidoscope } from "./molecules/MoleculeKaleidoscope";
import { MIDNIGHT_PALETTE, REFERENCE_PALETTE } from "./molecules/palettes";

// Reference clip: 302 frames (10.08 s @ 29.97) -> 302 frames @ 30 fps.
export const DURATION_IN_FRAMES = 302;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Molecules-V1-4K"
        component={MoleculeKaleidoscope}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: REFERENCE_PALETTE }}
      />
      <Composition
        id="Molecules-V2-4K"
        component={MoleculeKaleidoscope}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: MIDNIGHT_PALETTE }}
      />
    </>
  );
};
