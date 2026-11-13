import { Composition } from "remotion";
import { HydrogenMolecules } from "./hydrogen/HydrogenMolecules";

// Reference clip: 14.04 s. At 30 fps the closest whole-frame length is
// 421 frames (14.033 s) — Remotion/H.264 at constant 30 fps cannot express
// 14.04 s exactly (it would need 421.2 frames).
export const DURATION_FRAMES = 421;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HydrogenMolecules-V1-Match"
        component={HydrogenMolecules}
        durationInFrames={DURATION_FRAMES}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="HydrogenMolecules-V2-OrbitCamera"
        component={HydrogenMolecules}
        durationInFrames={DURATION_FRAMES}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
