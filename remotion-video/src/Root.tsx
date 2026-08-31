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
import { CandleClose, candleCloseSchema } from "./candle-close/CandleClose";
import {
  BASE_WIDTH as CANDLE_WIDTH,
  BASE_HEIGHT as CANDLE_HEIGHT,
  DURATION_IN_FRAMES as CANDLE_DURATION_IN_FRAMES,
  FPS as CANDLE_FPS,
} from "./candle-close/constants";

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
        id="CandleCloseBlue"
        component={CandleClose}
        durationInFrames={CANDLE_DURATION_IN_FRAMES}
        fps={CANDLE_FPS}
        width={CANDLE_WIDTH}
        height={CANDLE_HEIGHT}
        schema={candleCloseSchema}
        defaultProps={{ variant: "neonBlue" as const }}
      />
      <Composition
        id="CandleCloseAmber"
        component={CandleClose}
        durationInFrames={CANDLE_DURATION_IN_FRAMES}
        fps={CANDLE_FPS}
        width={CANDLE_WIDTH}
        height={CANDLE_HEIGHT}
        schema={candleCloseSchema}
        defaultProps={{ variant: "amberDark" as const }}
      />
      <Composition
        id="CandleCloseLight"
        component={CandleClose}
        durationInFrames={CANDLE_DURATION_IN_FRAMES}
        fps={CANDLE_FPS}
        width={CANDLE_WIDTH}
        height={CANDLE_HEIGHT}
        schema={candleCloseSchema}
        defaultProps={{ variant: "monoLight" as const }}
      />
    </>
  );
};
