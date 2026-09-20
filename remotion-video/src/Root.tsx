import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import {
  CodeCity,
  codeCitySchema,
  codeCityDefaults,
} from "./ai-code/CodeCity";
import {
  CodeWall,
  codeWallSchema,
  codeWallDefaults,
} from "./ai-code/CodeWall";
import {
  AiNetwork,
  aiNetworkSchema,
  aiNetworkDefaults,
} from "./ai-code/AiNetwork";
import {
  FPS as AI_FPS,
  DURATION_IN_FRAMES as AI_DURATION,
  BASE_WIDTH as AI_WIDTH,
  BASE_HEIGHT as AI_HEIGHT,
} from "./ai-code/constants";
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
        id="AiCodeCity"
        component={CodeCity}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH}
        height={AI_HEIGHT}
        schema={codeCitySchema}
        defaultProps={codeCityDefaults}
      />
      <Composition
        id="AiCodeWall"
        component={CodeWall}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH}
        height={AI_HEIGHT}
        schema={codeWallSchema}
        defaultProps={codeWallDefaults}
      />
      <Composition
        id="AiCodeWall4K"
        component={CodeWall}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH * 2}
        height={AI_HEIGHT * 2}
        schema={codeWallSchema}
        defaultProps={{ resolutionScale: 2 as const }}
      />
      <Composition
        id="AiNetwork"
        component={AiNetwork}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH}
        height={AI_HEIGHT}
        schema={aiNetworkSchema}
        defaultProps={aiNetworkDefaults}
      />
      <Composition
        id="AiNetwork4K"
        component={AiNetwork}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH * 2}
        height={AI_HEIGHT * 2}
        schema={aiNetworkSchema}
        defaultProps={{ resolutionScale: 2 as const }}
      />
      <Composition
        id="AiCodeCity4K"
        component={CodeCity}
        durationInFrames={AI_DURATION}
        fps={AI_FPS}
        width={AI_WIDTH * 2}
        height={AI_HEIGHT * 2}
        schema={codeCitySchema}
        defaultProps={{ resolutionScale: 2 as const }}
      />
    </>
  );
};
