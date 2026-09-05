import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import {
  ParticleDunes,
  particleDunesSchema,
  particleDunesDefaults,
} from "./particle-dunes/ParticleDunes";
import {
  BASE_WIDTH as DUNES_WIDTH,
  BASE_HEIGHT as DUNES_HEIGHT,
  DURATION_IN_FRAMES as DUNES_DURATION,
  FPS as DUNES_FPS,
} from "./particle-dunes/constants";
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
        id="ParticleDunesCyan"
        component={ParticleDunes}
        durationInFrames={DUNES_DURATION}
        fps={DUNES_FPS}
        width={DUNES_WIDTH}
        height={DUNES_HEIGHT}
        schema={particleDunesSchema}
        defaultProps={particleDunesDefaults}
      />
      <Composition
        id="ParticleDunesSand"
        component={ParticleDunes}
        durationInFrames={DUNES_DURATION}
        fps={DUNES_FPS}
        width={DUNES_WIDTH}
        height={DUNES_HEIGHT}
        schema={particleDunesSchema}
        defaultProps={{ ...particleDunesDefaults, palette: "sand" }}
      />
    </>
  );
};
