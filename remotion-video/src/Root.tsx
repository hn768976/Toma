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
  ForestScene,
  forestSceneSchema,
} from "./forest/ForestScene";
import {
  WIDTH as FOREST_WIDTH,
  HEIGHT as FOREST_HEIGHT,
  FPS as FOREST_FPS,
  DURATION_IN_FRAMES as FOREST_DURATION,
} from "./forest/constants";
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
        id="ForestEmber"
        component={ForestScene}
        durationInFrames={FOREST_DURATION}
        fps={FOREST_FPS}
        width={FOREST_WIDTH}
        height={FOREST_HEIGHT}
        schema={forestSceneSchema}
        defaultProps={{ variant: "ember" as const }}
      />
      <Composition
        id="ForestFrost"
        component={ForestScene}
        durationInFrames={FOREST_DURATION}
        fps={FOREST_FPS}
        width={FOREST_WIDTH}
        height={FOREST_HEIGHT}
        schema={forestSceneSchema}
        defaultProps={{ variant: "frost" as const }}
      />
      {/*
        One frame longer than the loop, and the layers are still driven by the
        240-frame loop via `loopFrames`. That makes frame 240 renderable and
        directly comparable with frame 0, which is how the seamless loop is
        verified — both variants come back at zero differing pixels.
      */}
      <Composition
        id="ForestLoopCheck"
        component={ForestScene}
        durationInFrames={FOREST_DURATION + 1}
        fps={FOREST_FPS}
        width={FOREST_WIDTH}
        height={FOREST_HEIGHT}
        schema={forestSceneSchema}
        defaultProps={{ variant: "ember" as const }}
      />
    </>
  );
};
