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
import { AiDataFlow, aiDataFlowSchema } from "./ai-flow/AiDataFlow";
import {
  DURATION_IN_FRAMES as AI_FLOW_DURATION_IN_FRAMES,
  FPS as AI_FLOW_FPS,
  HEIGHT_4K as AI_FLOW_HEIGHT,
  WIDTH_4K as AI_FLOW_WIDTH,
} from "./ai-flow/constants";

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
      {/* 4K masters. Render 1080p deliverables with --scale=0.5. */}
      <Composition
        id="AiDataFlowOriginal4K"
        component={AiDataFlow}
        durationInFrames={AI_FLOW_DURATION_IN_FRAMES}
        fps={AI_FLOW_FPS}
        width={AI_FLOW_WIDTH}
        height={AI_FLOW_HEIGHT}
        schema={aiDataFlowSchema}
        defaultProps={{ palette: "original" as const, label: "Ai" }}
      />
      <Composition
        id="AiDataFlowEmber4K"
        component={AiDataFlow}
        durationInFrames={AI_FLOW_DURATION_IN_FRAMES}
        fps={AI_FLOW_FPS}
        width={AI_FLOW_WIDTH}
        height={AI_FLOW_HEIGHT}
        schema={aiDataFlowSchema}
        defaultProps={{ palette: "ember" as const, label: "Ai" }}
      />
    </>
  );
};
