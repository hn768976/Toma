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
  BacteriaVersion,
  bacteriaVersionSchema,
  PRESETS,
  FPS as BACTERIA_FPS,
  WIDTH_4K,
  HEIGHT_4K,
} from "./bacteria";

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

      {/*
        The microscopic-bacteria series: eleven versions, one per
        reference clip. Each is authored natively at 4K/30fps and each
        runs exactly as long as the clip it answers to. The 1080p
        deliverables come off these same compositions via `--scale=0.5`,
        so there is no second set of comps to keep in sync.
      */}
      {PRESETS.map((preset) => (
        <Composition
          key={preset.id}
          id={preset.id}
          component={BacteriaVersion}
          durationInFrames={preset.durationInFrames}
          fps={BACTERIA_FPS}
          width={WIDTH_4K}
          height={HEIGHT_4K}
          schema={bacteriaVersionSchema}
          defaultProps={{ presetId: preset.id }}
        />
      ))}
    </>
  );
};
