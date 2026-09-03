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
  ParticleWaveField,
  particleWaveFieldSchema,
  particleWaveFieldDefaults,
} from "./particle-wave/ParticleWaveField";
import {
  BASE_WIDTH as WAVE_WIDTH,
  BASE_HEIGHT as WAVE_HEIGHT,
  DURATION_IN_FRAMES as WAVE_DURATION_IN_FRAMES,
  FPS as WAVE_FPS,
} from "./particle-wave/constants";

// The three colourways of the particle wave field. The composition is
// authored at 4K; render a 1080p preview with --scale=0.5.
const WAVE_VERSIONS = [
  { id: "V1-WaveMagentaCyan", paletteId: "magentaCyan" },
  { id: "V2-WaveBlueWhite", paletteId: "blueWhite" },
  { id: "V3-WaveAmberMagenta", paletteId: "amberMagenta" },
] as const;

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
      {WAVE_VERSIONS.map(({ id, paletteId }) => (
        <Composition
          key={id}
          id={id}
          component={ParticleWaveField}
          durationInFrames={WAVE_DURATION_IN_FRAMES}
          fps={WAVE_FPS}
          width={WAVE_WIDTH}
          height={WAVE_HEIGHT}
          schema={particleWaveFieldSchema}
          defaultProps={{ ...particleWaveFieldDefaults, paletteId }}
        />
      ))}
    </>
  );
};
