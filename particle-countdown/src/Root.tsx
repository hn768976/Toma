import { Composition, Folder } from "remotion";
import { ParticleCountdown } from "./countdown/ParticleCountdown";
import { DURATION, FPS } from "./countdown/timeline";

// Master compositions are authored in 4K UHD (3840×2160) at 30 fps.
// 345 frames = 11.5 s, identical to the reference clip.
export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Particle-Countdown-4K">
      <Composition
        id="Countdown-V1-Match"
        component={ParticleCountdown}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "cool" as const }}
      />
      <Composition
        id="Countdown-V2-Ember"
        component={ParticleCountdown}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ palette: "ember" as const }}
      />
    </Folder>
  );
};
