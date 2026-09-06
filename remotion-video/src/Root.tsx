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
  SystemDashboard,
  systemDashboardSchema,
} from "./system-dashboard/SystemDashboard";
import {
  BASE_W as DASH_W,
  BASE_H as DASH_H,
  DURATION_IN_FRAMES as DASH_DURATION,
  FPS as DASH_FPS,
} from "./system-dashboard/constants";

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
        Both dashboard variants are defined at 3840x2160 so they can be
        rendered at 4K. Render a 1080p preview with --scale=0.5.
      */}
      <Composition
        id="SystemDashboardMono"
        component={SystemDashboard}
        durationInFrames={DASH_DURATION}
        fps={DASH_FPS}
        width={DASH_W}
        height={DASH_H}
        schema={systemDashboardSchema}
        defaultProps={{ variant: "mono" as const }}
      />
      <Composition
        id="SystemDashboardCyan"
        component={SystemDashboard}
        durationInFrames={DASH_DURATION}
        fps={DASH_FPS}
        width={DASH_W}
        height={DASH_H}
        schema={systemDashboardSchema}
        defaultProps={{ variant: "cyan" as const }}
      />
    </>
  );
};
