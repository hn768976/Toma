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
  AiChipCircuit,
  aiChipCircuitSchema,
  aiChipCircuitDefaults,
} from "./ai-chip/AiChipCircuit";
import {
  FPS as CHIP_FPS,
  DURATION_IN_FRAMES as CHIP_DURATION_IN_FRAMES,
  WIDTH_4K,
  HEIGHT_4K,
  WIDTH_1080,
  HEIGHT_1080,
} from "./ai-chip/constants";

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
        id="AiChipCircuit4K"
        component={AiChipCircuit}
        durationInFrames={CHIP_DURATION_IN_FRAMES}
        fps={CHIP_FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        schema={aiChipCircuitSchema}
        defaultProps={{ ...aiChipCircuitDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="AiChipCircuit1080"
        component={AiChipCircuit}
        durationInFrames={CHIP_DURATION_IN_FRAMES}
        fps={CHIP_FPS}
        width={WIDTH_1080}
        height={HEIGHT_1080}
        schema={aiChipCircuitSchema}
        defaultProps={aiChipCircuitDefaults}
      />
    </>
  );
};
