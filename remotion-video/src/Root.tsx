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
import { HazardSymbol, hazardSymbolSchema } from "./hazard/HazardSymbol";
import {
  WIDTH as HAZARD_WIDTH,
  HEIGHT as HAZARD_HEIGHT,
  FPS as HAZARD_FPS,
  LOOP_FRAMES as HAZARD_FRAMES,
} from "./hazard/constants";
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
        id="HazardRadiation"
        component={HazardSymbol}
        durationInFrames={HAZARD_FRAMES}
        fps={HAZARD_FPS}
        width={HAZARD_WIDTH}
        height={HAZARD_HEIGHT}
        schema={hazardSymbolSchema}
        defaultProps={{ variant: "radiation" as const }}
      />
      <Composition
        id="HazardBiohazard"
        component={HazardSymbol}
        durationInFrames={HAZARD_FRAMES}
        fps={HAZARD_FPS}
        width={HAZARD_WIDTH}
        height={HAZARD_HEIGHT}
        schema={hazardSymbolSchema}
        defaultProps={{ variant: "biohazard" as const }}
      />
    </>
  );
};
