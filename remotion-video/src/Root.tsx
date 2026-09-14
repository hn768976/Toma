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
  CleanEnergyHud,
  cleanEnergyHudDefaults,
  cleanEnergyHudSchema,
} from "./hud/CleanEnergyHud";
import {
  HUD_DURATION_IN_FRAMES,
  HUD_FPS,
  UHD_HEIGHT,
  UHD_WIDTH,
  HD_HEIGHT,
  HD_WIDTH,
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
      {/* Clean-energy HUD console. The 4K compositions are the masters; the
          1080p pair exists so the studio and previews stay light. Deliverables
          are rendered from the 4K masters with `--scale 0.5`. */}
      <Composition
        id="CleanEnergyHUD-4K"
        component={CleanEnergyHud}
        durationInFrames={HUD_DURATION_IN_FRAMES}
        fps={HUD_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={cleanEnergyHudSchema}
        defaultProps={cleanEnergyHudDefaults}
      />
      <Composition
        id="CleanEnergyHUD-Blue-4K"
        component={CleanEnergyHud}
        durationInFrames={HUD_DURATION_IN_FRAMES}
        fps={HUD_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={cleanEnergyHudSchema}
        defaultProps={{ ...cleanEnergyHudDefaults, variant: "mirrored" }}
      />
      <Composition
        id="CleanEnergyHUD-1080p"
        component={CleanEnergyHud}
        durationInFrames={HUD_DURATION_IN_FRAMES}
        fps={HUD_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={cleanEnergyHudSchema}
        defaultProps={cleanEnergyHudDefaults}
      />
      <Composition
        id="CleanEnergyHUD-Blue-1080p"
        component={CleanEnergyHud}
        durationInFrames={HUD_DURATION_IN_FRAMES}
        fps={HUD_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={cleanEnergyHudSchema}
        defaultProps={{ ...cleanEnergyHudDefaults, variant: "mirrored" }}
      />
    </>
  );
};
