import { Composition, Folder } from "remotion";
import { ParticleBlob } from "./blob/ParticleBlob";
import { COBALT, EMBER } from "./blob/palettes";

// Both compositions are authored at native 4K UHD. The delivery renders use
// `--scale=0.5` to produce 1920x1080 from the 4K frame (see README).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION = 300; // 10.0 s – identical to the reference clip

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Particle-Blob-Morph">
      <Composition
        id="V1-Particle-Blob-Morph-Cobalt"
        component={ParticleBlob}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: COBALT }}
      />
      <Composition
        id="V2-Particle-Blob-Morph-Ember"
        component={ParticleBlob}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: EMBER }}
      />
    </Folder>
  );
};
