import { Composition, Folder } from "remotion";
import { DnaHelix } from "./dna/DnaHelix";
import { DURATION, FPS } from "./dna/timeline";

// Master compositions are authored in 4K UHD (3840×2160) at 30 fps.
// 520 frames = 17.333 s, identical to the reference clip.
export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="DNA-Helix-4K">
      <Composition
        id="DnaHelix-V1-Match"
        component={DnaHelix}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "match" }}
      />
      <Composition
        id="DnaHelix-V2-Orbit"
        component={DnaHelix}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ variant: "orbit" }}
      />
    </Folder>
  );
};
