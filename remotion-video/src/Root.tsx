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
import "./ai-generating/fonts";
import {
  AiGeneratingDark,
  aiGeneratingDarkSchema,
  aiGeneratingDarkDefaults,
} from "./ai-generating/AiGeneratingDark";
import {
  AiGeneratingLight,
  aiGeneratingLightSchema,
  aiGeneratingLightDefaults,
} from "./ai-generating/AiGeneratingLight";
import {
  BASE_WIDTH as AI_WIDTH,
  BASE_HEIGHT as AI_HEIGHT,
  DURATION_IN_FRAMES as AI_DURATION,
  FPS as AI_FPS,
} from "./ai-generating/constants";

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
        id="AiGeneratingDark"
        component={AiGeneratingDark}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH}
        height={AI_HEIGHT}
        schema={aiGeneratingDarkSchema}
        defaultProps={aiGeneratingDarkDefaults}
      />
      <Composition
        id="AiGeneratingDark4K"
        component={AiGeneratingDark}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH * 2}
        height={AI_HEIGHT * 2}
        schema={aiGeneratingDarkSchema}
        defaultProps={aiGeneratingDarkDefaults}
      />
      <Composition
        id="AiGeneratingLight"
        component={AiGeneratingLight}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH}
        height={AI_HEIGHT}
        schema={aiGeneratingLightSchema}
        defaultProps={aiGeneratingLightDefaults}
      />
      <Composition
        id="AiGeneratingLight4K"
        component={AiGeneratingLight}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH * 2}
        height={AI_HEIGHT * 2}
        schema={aiGeneratingLightSchema}
        defaultProps={aiGeneratingLightDefaults}
      />
    </>
  );
};
