import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import {
  BluetoothExplainer,
  bluetoothExplainerSchema,
  bluetoothExplainerDefaultProps,
} from "./BluetoothExplainer";
import { DURATION_IN_FRAMES, FPS, WIDTH, HEIGHT } from "./constants";
import {
  ParticleRingHalo,
  particleRingHaloSchema,
  particleRingHaloDefaults,
} from "./particle-ring/ParticleRingHalo";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";
import {
  NeonLightStreaks,
  neonLightStreaksSchema,
  neonLightStreaksDefaults,
} from "./light-streaks/NeonLightStreaks";
import {
  BASE_WIDTH as STREAK_WIDTH,
  BASE_HEIGHT as STREAK_HEIGHT,
  DURATION_IN_FRAMES as STREAK_DURATION_IN_FRAMES,
  FPS as STREAK_FPS,
} from "./light-streaks/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BluetoothExplainer"
        component={BluetoothExplainer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={bluetoothExplainerSchema}
        defaultProps={bluetoothExplainerDefaultProps}
      />
      <Composition
        id="ParticleRingHalo"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="ParticleRingHalo4K"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH * 2}
        height={BASE_HEIGHT * 2}
        schema={particleRingHaloSchema}
        defaultProps={{ ...particleRingHaloDefaults, resolutionScale: 2 }}
      />
      {/* Neon light streaks. Same motion in two colour grades, each at 1080p
          for delivery and at true vector 4K for the master. */}
      <Composition
        id="NeonStreaksBlue"
        component={NeonLightStreaks}
        durationInFrames={STREAK_DURATION_IN_FRAMES}
        fps={STREAK_FPS}
        width={STREAK_WIDTH}
        height={STREAK_HEIGHT}
        schema={neonLightStreaksSchema}
        defaultProps={{ ...neonLightStreaksDefaults, variant: "blue" as const }}
      />
      <Composition
        id="NeonStreaksBlue4K"
        component={NeonLightStreaks}
        durationInFrames={STREAK_DURATION_IN_FRAMES}
        fps={STREAK_FPS}
        width={STREAK_WIDTH * 2}
        height={STREAK_HEIGHT * 2}
        schema={neonLightStreaksSchema}
        defaultProps={{ ...neonLightStreaksDefaults, variant: "blue" as const }}
      />
      <Composition
        id="NeonStreaksViolet"
        component={NeonLightStreaks}
        durationInFrames={STREAK_DURATION_IN_FRAMES}
        fps={STREAK_FPS}
        width={STREAK_WIDTH}
        height={STREAK_HEIGHT}
        schema={neonLightStreaksSchema}
        defaultProps={{ ...neonLightStreaksDefaults, variant: "violet" as const }}
      />
      <Composition
        id="NeonStreaksViolet4K"
        component={NeonLightStreaks}
        durationInFrames={STREAK_DURATION_IN_FRAMES}
        fps={STREAK_FPS}
        width={STREAK_WIDTH * 2}
        height={STREAK_HEIGHT * 2}
        schema={neonLightStreaksSchema}
        defaultProps={{ ...neonLightStreaksDefaults, variant: "violet" as const }}
      />
    </>
  );
};
