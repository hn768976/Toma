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
  StarryTreeline,
  starryTreelineSchema,
  starryTreelineDefaults,
  starryTreelineMoonriseDefaults,
} from "./starry-treeline/StarryTreeline";
import {
  BASE_WIDTH as TREELINE_WIDTH,
  BASE_HEIGHT as TREELINE_HEIGHT,
  DURATION_IN_FRAMES as TREELINE_DURATION_IN_FRAMES,
  FPS as TREELINE_FPS,
} from "./starry-treeline/constants";

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
        Both starry-treeline compositions are defined at 4K so they can be
        rendered at full resolution later; render a 1080p preview with
        `--scale=0.5`.
      */}
      <Composition
        id="V1-StarryTreeline"
        component={StarryTreeline}
        durationInFrames={TREELINE_DURATION_IN_FRAMES}
        fps={TREELINE_FPS}
        width={TREELINE_WIDTH}
        height={TREELINE_HEIGHT}
        schema={starryTreelineSchema}
        defaultProps={starryTreelineDefaults}
      />
      <Composition
        id="V2-StarryTreelineMoonrise"
        component={StarryTreeline}
        durationInFrames={TREELINE_DURATION_IN_FRAMES}
        fps={TREELINE_FPS}
        width={TREELINE_WIDTH}
        height={TREELINE_HEIGHT}
        schema={starryTreelineSchema}
        defaultProps={starryTreelineMoonriseDefaults}
      />
    </>
  );
};
