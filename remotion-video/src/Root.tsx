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
  DownturnScene,
  downturnSchema,
  downturnDefaults,
} from "./market-arrow/DownturnScene";
import {
  RallyScene,
  rallySchema,
  rallyDefaults,
} from "./market-arrow/RallyScene";
import {
  DOWNTURN_DURATION_IN_FRAMES,
  RALLY_DURATION_IN_FRAMES,
  FPS as MARKET_FPS,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  UHD_HEIGHT,
  UHD_WIDTH,
} from "./market-arrow/constants";

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
      {/* Market arrow V1 - Downturn. 4K is the authoring master; the
          1080p sibling is the same frame at half scale. */}
      <Composition
        id="MarketDownturn4K"
        component={DownturnScene}
        durationInFrames={DOWNTURN_DURATION_IN_FRAMES}
        fps={MARKET_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={downturnSchema}
        defaultProps={{ ...downturnDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="MarketDownturn1080"
        component={DownturnScene}
        durationInFrames={DOWNTURN_DURATION_IN_FRAMES}
        fps={MARKET_FPS}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        schema={downturnSchema}
        defaultProps={{ ...downturnDefaults, resolutionScale: 1 }}
      />

      {/* Market arrow V2 - Rally. */}
      <Composition
        id="MarketRally4K"
        component={RallyScene}
        durationInFrames={RALLY_DURATION_IN_FRAMES}
        fps={MARKET_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={rallySchema}
        defaultProps={{ ...rallyDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="MarketRally1080"
        component={RallyScene}
        durationInFrames={RALLY_DURATION_IN_FRAMES}
        fps={MARKET_FPS}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        schema={rallySchema}
        defaultProps={{ ...rallyDefaults, resolutionScale: 1 }}
      />
    </>
  );
};
