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
  NeuralFiberFlow,
  neuralFiberFlowSchema,
  neuralFiberFlowDefaults,
} from "./neural/v1/NeuralFiberFlow";
import { V1_DURATION_IN_FRAMES, V1_FPS } from "./neural/v1/field";
import {
  IsometricNeuralLayers,
  isometricNeuralLayersSchema,
  isometricNeuralLayersDefaults,
} from "./neural/v2/IsometricNeuralLayers";
import { V2_DURATION_IN_FRAMES, V2_FPS } from "./neural/v2/field";
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
        id="NeuralFiberFlow4K"
        component={NeuralFiberFlow}
        durationInFrames={V1_DURATION_IN_FRAMES}
        fps={V1_FPS}
        width={3840}
        height={2160}
        schema={neuralFiberFlowSchema}
        defaultProps={neuralFiberFlowDefaults}
      />
      <Composition
        id="NeuralFiberFlow1080"
        component={NeuralFiberFlow}
        durationInFrames={V1_DURATION_IN_FRAMES}
        fps={V1_FPS}
        width={1920}
        height={1080}
        schema={neuralFiberFlowSchema}
        defaultProps={neuralFiberFlowDefaults}
      />
      <Composition
        id="IsometricNeuralLayers4K"
        component={IsometricNeuralLayers}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={V2_FPS}
        width={3840}
        height={2160}
        schema={isometricNeuralLayersSchema}
        defaultProps={isometricNeuralLayersDefaults}
      />
      <Composition
        id="IsometricNeuralLayers1080"
        component={IsometricNeuralLayers}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={V2_FPS}
        width={1920}
        height={1080}
        schema={isometricNeuralLayersSchema}
        defaultProps={isometricNeuralLayersDefaults}
      />
    </>
  );
};
