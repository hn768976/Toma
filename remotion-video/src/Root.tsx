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
import { PeriodicTable } from "./periodic/PeriodicTable";
import {
  DURATION_IN_FRAMES as PERIODIC_DURATION,
  FPS as PERIODIC_FPS,
  FRAME_HEIGHT as PERIODIC_HEIGHT,
  FRAME_WIDTH as PERIODIC_WIDTH,
} from "./periodic/layout";
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
        id="PeriodicAssemble"
        component={PeriodicTable}
        durationInFrames={PERIODIC_DURATION}
        fps={PERIODIC_FPS}
        width={PERIODIC_WIDTH}
        height={PERIODIC_HEIGHT}
        defaultProps={{ variant: "assemble" as const }}
      />
      <Composition
        id="PeriodicCategories"
        component={PeriodicTable}
        durationInFrames={PERIODIC_DURATION}
        fps={PERIODIC_FPS}
        width={PERIODIC_WIDTH}
        height={PERIODIC_HEIGHT}
        defaultProps={{ variant: "categories" as const }}
      />
    </>
  );
};
