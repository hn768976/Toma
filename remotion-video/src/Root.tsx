import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import { HudCentre, hudCentreSchema } from "./hud-centre/HudCentre";
import { DURATION as HUD_DURATION, FPS as HUD_FPS } from "./hud-centre/timing";
import { FRAME_H as HUD_H, FRAME_W as HUD_W } from "./hud-centre/layout";
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
        id="HudCentreWifi"
        component={HudCentre}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_W}
        height={HUD_H}
        schema={hudCentreSchema}
        defaultProps={{ variant: "wifi" as const }}
      />
      <Composition
        id="HudCentreCrypto"
        component={HudCentre}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_W}
        height={HUD_H}
        schema={hudCentreSchema}
        defaultProps={{ variant: "crypto" as const }}
      />
      <Composition
        id="HudCentreRadar"
        component={HudCentre}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_W}
        height={HUD_H}
        schema={hudCentreSchema}
        defaultProps={{ variant: "radar" as const }}
      />
    </>
  );
};
