import { Composition, Folder } from "remotion";
import { DnaHelix, DnaHelixProps } from "./dna/DnaHelix";

// Reference clip: 8.7 s @ 30 fps = 261 frames. Compositions are authored in 4K UHD.
export const FPS = 30;
export const DURATION_IN_FRAMES = 261;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="DNA-Helix-Macro-4K">
      <Composition
        id="DnaHelix-V1-Match"
        component={DnaHelix}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "match" } satisfies DnaHelixProps}
      />
      <Composition
        id="DnaHelix-V2-OrbitRackFocus"
        component={DnaHelix}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "orbit" } satisfies DnaHelixProps}
      />
    </Folder>
  );
};
