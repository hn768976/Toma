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
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
  WIDTH as RING_WIDTH,
  HEIGHT as RING_HEIGHT,
} from "./particle-ring/constants";
import {
  ParticleField,
  particleFieldSchema,
  particleBurstDefaults,
  DURATION_IN_FRAMES as BURST_DURATION_IN_FRAMES,
  FPS as BURST_FPS,
  WIDTH as BURST_WIDTH,
  HEIGHT as BURST_HEIGHT,
} from "./particle-burst";

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
        width={RING_WIDTH}
        height={RING_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="ParticleBurst"
        component={ParticleField}
        durationInFrames={BURST_DURATION_IN_FRAMES}
        fps={BURST_FPS}
        width={BURST_WIDTH}
        height={BURST_HEIGHT}
        schema={particleFieldSchema}
        defaultProps={particleBurstDefaults}
      />
    </>
  );
};
