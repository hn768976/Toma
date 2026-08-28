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
import { ShieldHud } from "./shield-hud/ShieldHud";
import {
  DURATION_IN_FRAMES as HUD_DURATION_IN_FRAMES,
  FPS as HUD_FPS,
  HEIGHT as HUD_HEIGHT,
  WIDTH as HUD_WIDTH,
} from "./shield-hud/constants";

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
        id="ShieldHudBlue"
        component={ShieldHud}
        durationInFrames={HUD_DURATION_IN_FRAMES}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="ShieldHudLoopCheck"
        component={ShieldHud}
        durationInFrames={HUD_DURATION_IN_FRAMES + 1}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
    </>
  );
};
