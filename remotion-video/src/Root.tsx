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
import { CyberShield, cyberShieldSchema } from "./cyber-shield/CyberShield";
import {
  DURATION_IN_FRAMES as SHIELD_DURATION_IN_FRAMES,
  FPS as SHIELD_FPS,
  HEIGHT_1080,
  HEIGHT_4K,
  WIDTH_1080,
  WIDTH_4K,
} from "./cyber-shield/constants";

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
      {/* Cyber-shield, version A (reference look) and version B
          (dark blue shield on cyan). Each is registered twice: the 1080p
          composition is the delivery master, the 4K one renders the same
          source at 3840x2160. */}
      <Composition
        id="CyberShieldNavy"
        component={CyberShield}
        durationInFrames={SHIELD_DURATION_IN_FRAMES}
        fps={SHIELD_FPS}
        width={WIDTH_1080}
        height={HEIGHT_1080}
        schema={cyberShieldSchema}
        defaultProps={{ theme: "navy" as const }}
      />
      <Composition
        id="CyberShieldNavy4K"
        component={CyberShield}
        durationInFrames={SHIELD_DURATION_IN_FRAMES}
        fps={SHIELD_FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        schema={cyberShieldSchema}
        defaultProps={{ theme: "navy" as const }}
      />
      <Composition
        id="CyberShieldCyan"
        component={CyberShield}
        durationInFrames={SHIELD_DURATION_IN_FRAMES}
        fps={SHIELD_FPS}
        width={WIDTH_1080}
        height={HEIGHT_1080}
        schema={cyberShieldSchema}
        defaultProps={{ theme: "cyan" as const }}
      />
      <Composition
        id="CyberShieldCyan4K"
        component={CyberShield}
        durationInFrames={SHIELD_DURATION_IN_FRAMES}
        fps={SHIELD_FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        schema={cyberShieldSchema}
        defaultProps={{ theme: "cyan" as const }}
      />
    </>
  );
};
