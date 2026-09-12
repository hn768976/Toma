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
  NorthAmericaDataMap,
  northAmericaDataMapSchema,
  northAmericaDataMapDefaults,
} from "./usa-map/NorthAmericaDataMap";
import {
  BASE_WIDTH as MAP_WIDTH,
  BASE_HEIGHT as MAP_HEIGHT,
  DURATION_IN_FRAMES as MAP_DURATION_IN_FRAMES,
  FPS as MAP_FPS,
} from "./usa-map/constants";

// The data-map ships in two colour grades, each at 1080p and 4K. Geometry is
// authored at 1x and multiplied by resolutionScale, so the 4K compositions are
// genuinely re-rendered at full resolution rather than upscaled.
const MAP_VARIANTS = [
  { id: "Signal", theme: "signal" as const },
  { id: "Cyan", theme: "cyan" as const },
];

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
      {MAP_VARIANTS.map(({ id, theme }) => (
        <Composition
          key={id}
          id={`NorthAmericaDataMap${id}`}
          component={NorthAmericaDataMap}
          durationInFrames={MAP_DURATION_IN_FRAMES}
          fps={MAP_FPS}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          schema={northAmericaDataMapSchema}
          defaultProps={{ ...northAmericaDataMapDefaults, theme }}
        />
      ))}
      {MAP_VARIANTS.map(({ id, theme }) => (
        <Composition
          key={`${id}4K`}
          id={`NorthAmericaDataMap${id}4K`}
          component={NorthAmericaDataMap}
          durationInFrames={MAP_DURATION_IN_FRAMES}
          fps={MAP_FPS}
          width={MAP_WIDTH * 2}
          height={MAP_HEIGHT * 2}
          schema={northAmericaDataMapSchema}
          defaultProps={{ ...northAmericaDataMapDefaults, theme, resolutionScale: 2 }}
        />
      ))}
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
    </>
  );
};
