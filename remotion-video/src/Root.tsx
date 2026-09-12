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
  CurrencyWorld,
  currencyWorldSchema,
  currencyWorldDefaults,
} from "./currency-world/CurrencyWorld";
import {
  BASE_WIDTH as CW_WIDTH,
  BASE_HEIGHT as CW_HEIGHT,
  DURATION_IN_FRAMES as CW_DURATION_IN_FRAMES,
  FPS as CW_FPS,
} from "./currency-world/constants";

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
        Same shot, four outputs: two camera directions x two
        resolutions. The scene is authored at 1920x1080 and scaled by
        (width / 1920), so each 4K composition is the 1080p framing
        rasterised larger — never a re-composed shot.
      */}
      <Composition
        id="CurrencyWorld-LTR-1080p"
        component={CurrencyWorld}
        durationInFrames={CW_DURATION_IN_FRAMES}
        fps={CW_FPS}
        width={CW_WIDTH}
        height={CW_HEIGHT}
        schema={currencyWorldSchema}
        defaultProps={{ ...currencyWorldDefaults, direction: "ltr" as const, palette: "steel" as const }}
      />
      <Composition
        id="CurrencyWorld-RTL-1080p"
        component={CurrencyWorld}
        durationInFrames={CW_DURATION_IN_FRAMES}
        fps={CW_FPS}
        width={CW_WIDTH}
        height={CW_HEIGHT}
        schema={currencyWorldSchema}
        defaultProps={{ ...currencyWorldDefaults, direction: "rtl" as const, palette: "midnight" as const }}
      />
      <Composition
        id="CurrencyWorld-LTR-4K"
        component={CurrencyWorld}
        durationInFrames={CW_DURATION_IN_FRAMES}
        fps={CW_FPS}
        width={CW_WIDTH * 2}
        height={CW_HEIGHT * 2}
        schema={currencyWorldSchema}
        defaultProps={{ ...currencyWorldDefaults, direction: "ltr" as const, palette: "steel" as const }}
      />
      <Composition
        id="CurrencyWorld-RTL-4K"
        component={CurrencyWorld}
        durationInFrames={CW_DURATION_IN_FRAMES}
        fps={CW_FPS}
        width={CW_WIDTH * 2}
        height={CW_HEIGHT * 2}
        schema={currencyWorldSchema}
        defaultProps={{ ...currencyWorldDefaults, direction: "rtl" as const, palette: "midnight" as const }}
      />
    </>
  );
};
