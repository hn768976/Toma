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
  AIHubNetwork,
  aiHubSchema,
  aiHubBlueDefaults,
  aiHubTealDefaults,
} from "./ai-hub/AIHubNetwork";
import {
  BASE_WIDTH as HUB_WIDTH,
  BASE_HEIGHT as HUB_HEIGHT,
  DURATION_IN_FRAMES as HUB_DURATION_IN_FRAMES,
  FPS as HUB_FPS,
} from "./ai-hub/constants";

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
        id="V1-AIHubBlue"
        component={AIHubNetwork}
        durationInFrames={HUB_DURATION_IN_FRAMES}
        fps={HUB_FPS}
        width={HUB_WIDTH}
        height={HUB_HEIGHT}
        schema={aiHubSchema}
        defaultProps={aiHubBlueDefaults}
      />
      <Composition
        id="V2-AIHubTeal"
        component={AIHubNetwork}
        durationInFrames={HUB_DURATION_IN_FRAMES}
        fps={HUB_FPS}
        width={HUB_WIDTH}
        height={HUB_HEIGHT}
        schema={aiHubSchema}
        defaultProps={aiHubTealDefaults}
      />
    </>
  );
};
