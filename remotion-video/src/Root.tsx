import "./index.css";
import "./load-fonts";
import "./hud/fonts";
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
import { HudBlue, hudDefaults, hudSchema } from "./hud/HudBlue";
import { HudViolet } from "./hud/HudViolet";
import {
  BASE_WIDTH as HUD_WIDTH,
  BASE_HEIGHT as HUD_HEIGHT,
  DURATION_IN_FRAMES as HUD_DURATION,
  FPS as HUD_FPS,
} from "./hud/constants";

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
      <Composition
        id="HudBlue"
        component={HudBlue}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        schema={hudSchema}
        defaultProps={hudDefaults}
      />
      <Composition
        id="HudBlue4K"
        component={HudBlue}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_WIDTH * 2}
        height={HUD_HEIGHT * 2}
        schema={hudSchema}
        defaultProps={{ ...hudDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="HudViolet"
        component={HudViolet}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        schema={hudSchema}
        defaultProps={hudDefaults}
      />
      <Composition
        id="HudViolet4K"
        component={HudViolet}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_WIDTH * 2}
        height={HUD_HEIGHT * 2}
        schema={hudSchema}
        defaultProps={{ ...hudDefaults, resolutionScale: 2 }}
      />
    </>
  );
};
