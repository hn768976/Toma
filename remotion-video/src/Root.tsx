import "./index.css";
import "./load-fonts";
import "./data-charts/fonts";
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
  DataCharts,
  dataChartsSchema,
  dataChartsDefaults,
} from "./data-charts/DataCharts";
import {
  BASE_WIDTH as CHARTS_WIDTH,
  BASE_HEIGHT as CHARTS_HEIGHT,
  DURATION_IN_FRAMES as CHARTS_DURATION_IN_FRAMES,
  FPS as CHARTS_FPS,
} from "./data-charts/constants";

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
      {/* Digital data charts dashboard: dark (reference look) and light,
          each at 1080p and 4K. The 4K variants render the same scene at 2x. */}
      <Composition
        id="DataChartsDark"
        component={DataCharts}
        durationInFrames={CHARTS_DURATION_IN_FRAMES}
        fps={CHARTS_FPS}
        width={CHARTS_WIDTH}
        height={CHARTS_HEIGHT}
        schema={dataChartsSchema}
        defaultProps={{ ...dataChartsDefaults, theme: "dark" }}
      />
      <Composition
        id="DataChartsLight"
        component={DataCharts}
        durationInFrames={CHARTS_DURATION_IN_FRAMES}
        fps={CHARTS_FPS}
        width={CHARTS_WIDTH}
        height={CHARTS_HEIGHT}
        schema={dataChartsSchema}
        defaultProps={{ ...dataChartsDefaults, theme: "light" }}
      />
      <Composition
        id="DataChartsDark4K"
        component={DataCharts}
        durationInFrames={CHARTS_DURATION_IN_FRAMES}
        fps={CHARTS_FPS}
        width={CHARTS_WIDTH * 2}
        height={CHARTS_HEIGHT * 2}
        schema={dataChartsSchema}
        defaultProps={{ ...dataChartsDefaults, theme: "dark" }}
      />
      <Composition
        id="DataChartsLight4K"
        component={DataCharts}
        durationInFrames={CHARTS_DURATION_IN_FRAMES}
        fps={CHARTS_FPS}
        width={CHARTS_WIDTH * 2}
        height={CHARTS_HEIGHT * 2}
        schema={dataChartsSchema}
        defaultProps={{ ...dataChartsDefaults, theme: "light" }}
      />
    </>
  );
};
