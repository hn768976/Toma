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
  MarketMap,
  marketMapSchema,
  marketMapDefaults,
} from "./market-map/MarketMap";
import {
  BASE_WIDTH as MAP_WIDTH,
  BASE_HEIGHT as MAP_HEIGHT,
  DURATION_IN_FRAMES as MAP_DURATION_IN_FRAMES,
  FPS as MAP_FPS,
} from "./market-map/constants";

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

      {/* Global market dot-map. Each cut is registered twice: 1080p for
          delivery and 4K for the project hand-off. The 4K pair differs
          only in resolutionScale, so both stay in visual sync. */}
      <Composition
        id="MarketMapBearish"
        component={MarketMap}
        durationInFrames={MAP_DURATION_IN_FRAMES}
        fps={MAP_FPS}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        schema={marketMapSchema}
        defaultProps={{ ...marketMapDefaults, theme: "bearish" as const }}
      />
      <Composition
        id="MarketMapBullish"
        component={MarketMap}
        durationInFrames={MAP_DURATION_IN_FRAMES}
        fps={MAP_FPS}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        schema={marketMapSchema}
        defaultProps={{ ...marketMapDefaults, theme: "bullish" as const }}
      />
      <Composition
        id="MarketMapBearish4K"
        component={MarketMap}
        durationInFrames={MAP_DURATION_IN_FRAMES}
        fps={MAP_FPS}
        width={MAP_WIDTH * 2}
        height={MAP_HEIGHT * 2}
        schema={marketMapSchema}
        defaultProps={{
          ...marketMapDefaults,
          theme: "bearish" as const,
          resolutionScale: 2,
        }}
      />
      <Composition
        id="MarketMapBullish4K"
        component={MarketMap}
        durationInFrames={MAP_DURATION_IN_FRAMES}
        fps={MAP_FPS}
        width={MAP_WIDTH * 2}
        height={MAP_HEIGHT * 2}
        schema={marketMapSchema}
        defaultProps={{
          ...marketMapDefaults,
          theme: "bullish" as const,
          resolutionScale: 2,
        }}
      />
    </>
  );
};
