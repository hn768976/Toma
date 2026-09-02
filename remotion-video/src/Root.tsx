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
  ParticleBrain,
  particleBrainSchema,
  particleBrainDefaultProps,
} from "./particle-brain/ParticleBrain";
import {
  DURATION_IN_FRAMES as BRAIN_DURATION,
  FPS as BRAIN_FPS,
  WIDTH as BRAIN_WIDTH,
  HEIGHT as BRAIN_HEIGHT,
} from "./particle-brain/config";
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
        id="ParticleBrain"
        component={ParticleBrain}
        durationInFrames={BRAIN_DURATION}
        fps={BRAIN_FPS}
        width={BRAIN_WIDTH}
        height={BRAIN_HEIGHT}
        schema={particleBrainSchema}
        defaultProps={particleBrainDefaultProps}
      />
      {/* Same composition one frame longer, so a render of frame 600 can be
          pixel-compared against frame 0 to prove the loop closes. */}
      <Composition
        id="ParticleBrainLoopCheck"
        component={ParticleBrain}
        durationInFrames={BRAIN_DURATION + 1}
        fps={BRAIN_FPS}
        width={BRAIN_WIDTH}
        height={BRAIN_HEIGHT}
        schema={particleBrainSchema}
        defaultProps={particleBrainDefaultProps}
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
    </>
  );
};
