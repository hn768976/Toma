import "./index.css";
import "./load-fonts";
import "./data-dashboard/fonts";
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
  DashboardV1,
  dashboardV1Schema,
  dashboardV1Defaults,
} from "./data-dashboard/versions/DashboardV1";
import {
  DashboardV2,
  dashboardV2Schema,
  dashboardV2Defaults,
} from "./data-dashboard/versions/DashboardV2";
import {
  DashboardV3,
  dashboardV3Schema,
  dashboardV3Defaults,
} from "./data-dashboard/versions/DashboardV3";
import {
  DashboardV4,
  dashboardV4Schema,
  dashboardV4Defaults,
} from "./data-dashboard/versions/DashboardV4";
import {
  FPS as DASH_FPS,
  BASE_WIDTH as DASH_WIDTH,
  BASE_HEIGHT as DASH_HEIGHT,
  DURATION_V1,
  DURATION_V2,
  DURATION_V3,
  DURATION_V4,
} from "./data-dashboard/constants";

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
        id="DashboardV1"
        component={DashboardV1}
        durationInFrames={DURATION_V1}
        fps={DASH_FPS}
        width={DASH_WIDTH}
        height={DASH_HEIGHT}
        schema={dashboardV1Schema}
        defaultProps={dashboardV1Defaults}
      />
      <Composition
        id="DashboardV1-4K"
        component={DashboardV1}
        durationInFrames={DURATION_V1}
        fps={DASH_FPS}
        width={DASH_WIDTH * 2}
        height={DASH_HEIGHT * 2}
        schema={dashboardV1Schema}
        defaultProps={{ ...dashboardV1Defaults, resolutionScale: 2 }}
      />
      <Composition
        id="DashboardV2"
        component={DashboardV2}
        durationInFrames={DURATION_V2}
        fps={DASH_FPS}
        width={DASH_WIDTH}
        height={DASH_HEIGHT}
        schema={dashboardV2Schema}
        defaultProps={dashboardV2Defaults}
      />
      <Composition
        id="DashboardV2-4K"
        component={DashboardV2}
        durationInFrames={DURATION_V2}
        fps={DASH_FPS}
        width={DASH_WIDTH * 2}
        height={DASH_HEIGHT * 2}
        schema={dashboardV2Schema}
        defaultProps={{ ...dashboardV2Defaults, resolutionScale: 2 }}
      />
      <Composition
        id="DashboardV3"
        component={DashboardV3}
        durationInFrames={DURATION_V3}
        fps={DASH_FPS}
        width={DASH_WIDTH}
        height={DASH_HEIGHT}
        schema={dashboardV3Schema}
        defaultProps={dashboardV3Defaults}
      />
      <Composition
        id="DashboardV3-4K"
        component={DashboardV3}
        durationInFrames={DURATION_V3}
        fps={DASH_FPS}
        width={DASH_WIDTH * 2}
        height={DASH_HEIGHT * 2}
        schema={dashboardV3Schema}
        defaultProps={{ ...dashboardV3Defaults, resolutionScale: 2 }}
      />
      <Composition
        id="DashboardV4"
        component={DashboardV4}
        durationInFrames={DURATION_V4}
        fps={DASH_FPS}
        width={DASH_WIDTH}
        height={DASH_HEIGHT}
        schema={dashboardV4Schema}
        defaultProps={dashboardV4Defaults}
      />
      <Composition
        id="DashboardV4-4K"
        component={DashboardV4}
        durationInFrames={DURATION_V4}
        fps={DASH_FPS}
        width={DASH_WIDTH * 2}
        height={DASH_HEIGHT * 2}
        schema={dashboardV4Schema}
        defaultProps={{ ...dashboardV4Defaults, resolutionScale: 2 }}
      />
    </>
  );
};
