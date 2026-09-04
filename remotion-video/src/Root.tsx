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
  FoggyForest,
  foggyForestSchema,
} from "./foggy-forest/FoggyForest";
import {
  WIDTH as FOG_WIDTH,
  HEIGHT as FOG_HEIGHT,
  FPS as FOG_FPS,
  DURATION_IN_FRAMES as FOG_DURATION,
} from "./foggy-forest/constants";
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
      {(
        [
          ["V1-FoggyForestTeal", "teal"],
          ["V2-FoggyForestAmber", "amber"],
          ["V3-FoggyForestMono", "mono"],
        ] as const
      ).map(([id, palette]) => (
        <Composition
          key={id}
          id={id}
          component={FoggyForest}
          durationInFrames={FOG_DURATION}
          fps={FOG_FPS}
          width={FOG_WIDTH}
          height={FOG_HEIGHT}
          schema={foggyForestSchema}
          defaultProps={{ palette }}
        />
      ))}
    </>
  );
};
