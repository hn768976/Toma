import "./index.css";
import "./load-fonts";
import "./trading-floor/fonts";
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
  TradingFloor,
  tradingFloorSchema,
  tradingFloorDefaults,
} from "./trading-floor";
import {
  DURATION_IN_FRAMES as FLOOR_DURATION,
  FPS as FLOOR_FPS,
  HD,
  UHD,
} from "./trading-floor/constants";
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

      {/* Trading floor: the 1080p deliverables and their 4K masters.
          All four share one 1920x1080 design space, so the 4K pair is the
          same frame re-rasterised at 2x, not an upscale. */}
      <Composition
        id="TradingFloor-Dark-1080p"
        component={TradingFloor}
        durationInFrames={FLOOR_DURATION}
        fps={FLOOR_FPS}
        width={HD.width}
        height={HD.height}
        schema={tradingFloorSchema}
        defaultProps={{ ...tradingFloorDefaults, theme: "dark" as const }}
      />
      <Composition
        id="TradingFloor-Light-1080p"
        component={TradingFloor}
        durationInFrames={FLOOR_DURATION}
        fps={FLOOR_FPS}
        width={HD.width}
        height={HD.height}
        schema={tradingFloorSchema}
        defaultProps={{ ...tradingFloorDefaults, theme: "light" as const }}
      />
      <Composition
        id="TradingFloor-Dark-4K"
        component={TradingFloor}
        durationInFrames={FLOOR_DURATION}
        fps={FLOOR_FPS}
        width={UHD.width}
        height={UHD.height}
        schema={tradingFloorSchema}
        defaultProps={{ ...tradingFloorDefaults, theme: "dark" as const }}
      />
      <Composition
        id="TradingFloor-Light-4K"
        component={TradingFloor}
        durationInFrames={FLOOR_DURATION}
        fps={FLOOR_FPS}
        width={UHD.width}
        height={UHD.height}
        schema={tradingFloorSchema}
        defaultProps={{ ...tradingFloorDefaults, theme: "light" as const }}
      />
    </>
  );
};
