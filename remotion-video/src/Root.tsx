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
  FinanceDashboard,
  financeDashboardSchema,
  financeDashboardDefaults,
} from "./finance-dashboard/FinanceDashboard";
import {
  BASE_WIDTH as DASH_WIDTH,
  BASE_HEIGHT as DASH_HEIGHT,
  DURATION_IN_FRAMES as DASH_DURATION_IN_FRAMES,
  FPS as DASH_FPS,
} from "./finance-dashboard/constants";

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
      {/* Financial AI analytics dashboard — reference (red/blue/green) palette */}
      <Composition
        id="FinanceDashboard"
        component={FinanceDashboard}
        durationInFrames={DASH_DURATION_IN_FRAMES}
        fps={DASH_FPS}
        width={DASH_WIDTH}
        height={DASH_HEIGHT}
        schema={financeDashboardSchema}
        defaultProps={{ ...financeDashboardDefaults, theme: "reference" }}
      />
      <Composition
        id="FinanceDashboard4K"
        component={FinanceDashboard}
        durationInFrames={DASH_DURATION_IN_FRAMES}
        fps={DASH_FPS}
        width={DASH_WIDTH * 2}
        height={DASH_HEIGHT * 2}
        schema={financeDashboardSchema}
        defaultProps={{ theme: "reference", resolutionScale: 2 }}
      />
      {/* Same piece in the dark-cyan palette */}
      <Composition
        id="FinanceDashboardCyan"
        component={FinanceDashboard}
        durationInFrames={DASH_DURATION_IN_FRAMES}
        fps={DASH_FPS}
        width={DASH_WIDTH}
        height={DASH_HEIGHT}
        schema={financeDashboardSchema}
        defaultProps={{ theme: "dark-cyan", resolutionScale: 1 }}
      />
      <Composition
        id="FinanceDashboardCyan4K"
        component={FinanceDashboard}
        durationInFrames={DASH_DURATION_IN_FRAMES}
        fps={DASH_FPS}
        width={DASH_WIDTH * 2}
        height={DASH_HEIGHT * 2}
        schema={financeDashboardSchema}
        defaultProps={{ theme: "dark-cyan", resolutionScale: 2 }}
      />
    </>
  );
};
