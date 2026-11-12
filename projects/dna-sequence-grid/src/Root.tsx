import "./index.css";
import { Composition } from "remotion";
import { DnaSequence } from "./dna/DnaSequence";

// Reference clip: 751 frames @ 30 fps = 25.033 s
export const DURATION_IN_FRAMES = 751;
export const FPS = 30;
// Authored in 4K UHD; deliverables are rendered with --scale=0.5 (1920x1080).
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DnaSequence-V1-Match"
        component={DnaSequence}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "reference" as const }}
      />
      <Composition
        id="DnaSequence-V2-FluorescentPalette"
        component={DnaSequence}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "fluorescent" as const }}
      />
    </>
  );
};
