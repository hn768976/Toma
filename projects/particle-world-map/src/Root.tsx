import { Composition } from "remotion";
import { WorldMapHologram } from "./map/WorldMapHologram";

// Both compositions are authored at native 4K UHD (3840x2160), 30 fps,
// 300 frames = 10.000 s (exact length of the reference clip).
const FPS = 30;
const DURATION = 300;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (locked-off frontal camera). */}
      <Composition
        id="ParticleWorldMap-V1-Reference-4K"
        component={WorldMapHologram}
        fps={FPS}
        durationInFrames={DURATION}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "reference" as const }}
      />
      {/* Version 2: alternative camera movement — low-angle orbital crane. */}
      <Composition
        id="ParticleWorldMap-V2-OrbitCamera-4K"
        component={WorldMapHologram}
        fps={FPS}
        durationInFrames={DURATION}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ camera: "orbit" as const }}
      />
    </>
  );
};
