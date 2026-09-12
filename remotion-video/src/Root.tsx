import "./index.css";
import "./load-fonts";
import "./agent-builder/fonts";
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
  AgentBuilderSignal,
  agentBuilderSchema,
  signalDefaultProps,
} from "./agent-builder/AgentBuilderSignal";
import {
  AgentBuilderMeridian,
  meridianDefaultProps,
} from "./agent-builder/AgentBuilderMeridian";
import {
  BASE_WIDTH as AB_WIDTH,
  BASE_HEIGHT as AB_HEIGHT,
  UHD_WIDTH as AB_UHD_WIDTH,
  UHD_HEIGHT as AB_UHD_HEIGHT,
  DURATION_IN_FRAMES as AB_DURATION,
  FPS as AB_FPS,
} from "./agent-builder/constants";

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

      {/* ---- AI Agent Builder: version A ("Signal"), reference layout ---- */}
      <Composition
        id="AgentBuilder-Signal-1080p"
        component={AgentBuilderSignal}
        durationInFrames={AB_DURATION}
        fps={AB_FPS}
        width={AB_WIDTH}
        height={AB_HEIGHT}
        schema={agentBuilderSchema}
        defaultProps={signalDefaultProps}
      />
      <Composition
        id="AgentBuilder-Signal-4K"
        component={AgentBuilderSignal}
        durationInFrames={AB_DURATION}
        fps={AB_FPS}
        width={AB_UHD_WIDTH}
        height={AB_UHD_HEIGHT}
        schema={agentBuilderSchema}
        defaultProps={signalDefaultProps}
      />

      {/* ---- version B ("Meridian"), alternate layout + dark cyan ------- */}
      <Composition
        id="AgentBuilder-Meridian-1080p"
        component={AgentBuilderMeridian}
        durationInFrames={AB_DURATION}
        fps={AB_FPS}
        width={AB_WIDTH}
        height={AB_HEIGHT}
        schema={agentBuilderSchema}
        defaultProps={meridianDefaultProps}
      />
      <Composition
        id="AgentBuilder-Meridian-4K"
        component={AgentBuilderMeridian}
        durationInFrames={AB_DURATION}
        fps={AB_FPS}
        width={AB_UHD_WIDTH}
        height={AB_UHD_HEIGHT}
        schema={agentBuilderSchema}
        defaultProps={meridianDefaultProps}
      />
    </>
  );
};
