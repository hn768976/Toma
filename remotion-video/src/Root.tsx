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
  SearchBar,
  SEARCH_BAR_DURATION,
  SEARCH_BAR_FPS,
  SEARCH_BAR_HEIGHT,
  SEARCH_BAR_WIDTH,
} from "./search-bar/SearchBar";

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
        id="SearchBarCyan"
        component={SearchBar}
        durationInFrames={SEARCH_BAR_DURATION}
        fps={SEARCH_BAR_FPS}
        width={SEARCH_BAR_WIDTH}
        height={SEARCH_BAR_HEIGHT}
        defaultProps={{ variant: "cyan" as const }}
      />
      <Composition
        id="SearchBarGreen"
        component={SearchBar}
        durationInFrames={SEARCH_BAR_DURATION}
        fps={SEARCH_BAR_FPS}
        width={SEARCH_BAR_WIDTH}
        height={SEARCH_BAR_HEIGHT}
        defaultProps={{ variant: "green" as const }}
      />
    </>
  );
};
