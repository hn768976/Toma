import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import { AiCompositions } from "./ai/AiCompositions";
import { AiTest, aiTestDefaults } from "./ai/AiTest";
import { AiDebug } from "./ai/AiDebug";
import { AiProbe } from "./ai/AiProbe";
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
        id="AiTest"
        component={AiTest}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={aiTestDefaults}
      />
      <Composition
        id="AiDebug"
        component={AiDebug}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition id="AiProbe" component={AiProbe} durationInFrames={30} fps={30} width={1920} height={1080} />
      <AiCompositions />
    </>
  );
};
