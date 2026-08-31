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
import { WaveField, waveFieldSchema } from "./wave-field/WaveField";
import {
  DURATION_IN_FRAMES as WAVE_DURATION_IN_FRAMES,
  FPS as WAVE_FPS,
  HEIGHT as WAVE_HEIGHT,
  WIDTH as WAVE_WIDTH,
} from "./wave-field/constants";
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
        id="WaveFieldBlue"
        component={WaveField}
        durationInFrames={WAVE_DURATION_IN_FRAMES}
        fps={WAVE_FPS}
        width={WAVE_WIDTH}
        height={WAVE_HEIGHT}
        schema={waveFieldSchema}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="LoopCheck"
        component={WaveField}
        durationInFrames={WAVE_DURATION_IN_FRAMES + 1}
        fps={WAVE_FPS}
        width={WAVE_WIDTH}
        height={WAVE_HEIGHT}
        schema={waveFieldSchema}
        defaultProps={{ variant: "blue" as const }}
      />
    </>
  );
};
