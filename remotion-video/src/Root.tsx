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
  NeuralSphere,
  neuralSphereSchema,
  neuralSphereDefaults,
} from "./neural-sphere/NeuralSphere";
import {
  BASE_WIDTH as NEURAL_WIDTH,
  BASE_HEIGHT as NEURAL_HEIGHT,
  DURATION_IN_FRAMES as NEURAL_DURATION_IN_FRAMES,
  FPS as NEURAL_FPS,
} from "./neural-sphere/constants";

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
      {/* --- Neural sphere -------------------------------------------
          Four compositions, one scene: two colour variants x two
          resolutions. The 1080p and 4K pairs are identical apart from
          `resolutionScale`, which scales line widths and dot sizes so
          both read the same at their own output size. --- */}
      <Composition
        id="NeuralSphereBlue"
        component={NeuralSphere}
        durationInFrames={NEURAL_DURATION_IN_FRAMES}
        fps={NEURAL_FPS}
        width={NEURAL_WIDTH}
        height={NEURAL_HEIGHT}
        schema={neuralSphereSchema}
        defaultProps={neuralSphereDefaults}
      />
      <Composition
        id="NeuralSphereBlue4K"
        component={NeuralSphere}
        durationInFrames={NEURAL_DURATION_IN_FRAMES}
        fps={NEURAL_FPS}
        width={NEURAL_WIDTH * 2}
        height={NEURAL_HEIGHT * 2}
        schema={neuralSphereSchema}
        defaultProps={{ ...neuralSphereDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="NeuralSphereCyan"
        component={NeuralSphere}
        durationInFrames={NEURAL_DURATION_IN_FRAMES}
        fps={NEURAL_FPS}
        width={NEURAL_WIDTH}
        height={NEURAL_HEIGHT}
        schema={neuralSphereSchema}
        defaultProps={{ ...neuralSphereDefaults, variant: "darkCyan" }}
      />
      <Composition
        id="NeuralSphereCyan4K"
        component={NeuralSphere}
        durationInFrames={NEURAL_DURATION_IN_FRAMES}
        fps={NEURAL_FPS}
        width={NEURAL_WIDTH * 2}
        height={NEURAL_HEIGHT * 2}
        schema={neuralSphereSchema}
        defaultProps={{
          ...neuralSphereDefaults,
          variant: "darkCyan",
          resolutionScale: 2,
        }}
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
    </>
  );
};
