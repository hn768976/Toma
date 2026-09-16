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
  ParticleWave,
  particleWaveSchema,
  particleWaveDefaults,
} from "./particle-wave/ParticleWave";
import {
  BASE_WIDTH as WAVE_WIDTH,
  BASE_HEIGHT as WAVE_HEIGHT,
  DURATION_IN_FRAMES as WAVE_DURATION_IN_FRAMES,
  FPS as WAVE_FPS,
} from "./particle-wave/constants";

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

      {/* Digital particle wave — reference (blue) grade. */}
      <Composition
        id="ParticleWave4K"
        component={ParticleWave}
        durationInFrames={WAVE_DURATION_IN_FRAMES}
        fps={WAVE_FPS}
        width={WAVE_WIDTH * 2}
        height={WAVE_HEIGHT * 2}
        schema={particleWaveSchema}
        defaultProps={{ ...particleWaveDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="ParticleWave1080p"
        component={ParticleWave}
        durationInFrames={WAVE_DURATION_IN_FRAMES}
        fps={WAVE_FPS}
        width={WAVE_WIDTH}
        height={WAVE_HEIGHT}
        schema={particleWaveSchema}
        defaultProps={{ ...particleWaveDefaults, resolutionScale: 1 }}
      />

      {/* Digital particle wave — monochrome black & white grade. */}
      <Composition
        id="ParticleWaveMono4K"
        component={ParticleWave}
        durationInFrames={WAVE_DURATION_IN_FRAMES}
        fps={WAVE_FPS}
        width={WAVE_WIDTH * 2}
        height={WAVE_HEIGHT * 2}
        schema={particleWaveSchema}
        defaultProps={{ palette: "mono", resolutionScale: 2 }}
      />
      <Composition
        id="ParticleWaveMono1080p"
        component={ParticleWave}
        durationInFrames={WAVE_DURATION_IN_FRAMES}
        fps={WAVE_FPS}
        width={WAVE_WIDTH}
        height={WAVE_HEIGHT}
        schema={particleWaveSchema}
        defaultProps={{ palette: "mono", resolutionScale: 1 }}
      />
    </>
  );
};
