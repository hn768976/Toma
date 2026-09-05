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
  RadialEqualizer,
  radialEqualizerSchema,
} from "./radial-equalizer/RadialEqualizer";
import {
  BASE_WIDTH as EQ_WIDTH,
  BASE_HEIGHT as EQ_HEIGHT,
  DURATION_IN_FRAMES as EQ_DURATION,
  FPS as EQ_FPS,
} from "./radial-equalizer/constants";

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
        id="V1-RadialEqualizerOrangeBlue"
        component={RadialEqualizer}
        durationInFrames={EQ_DURATION}
        fps={EQ_FPS}
        width={EQ_WIDTH}
        height={EQ_HEIGHT}
        schema={radialEqualizerSchema}
        defaultProps={{ variant: "orangeBlue" as const }}
      />
      <Composition
        id="V2-RadialEqualizerGoldMagenta"
        component={RadialEqualizer}
        durationInFrames={EQ_DURATION}
        fps={EQ_FPS}
        width={EQ_WIDTH}
        height={EQ_HEIGHT}
        schema={radialEqualizerSchema}
        defaultProps={{ variant: "goldMagenta" as const }}
      />
    </>
  );
};
