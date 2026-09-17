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
  NeuralField,
  neuralFieldSchema,
  neuralFieldDefaults,
} from "./neural-field/NeuralField";
import {
  FPS as NF_FPS,
  DURATION_IN_FRAMES as NF_DURATION,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
} from "./neural-field/constants";

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
        The neural-field background, as four compositions: each of the two
        colour treatments at 1080p for delivery and at 4K for mastering.
        `resolutionScale` is what keeps the 4K versions identical in look
        rather than sparser — see neural-field/constants.ts.
      */}
      <Composition
        id="NeuralFieldAurora"
        component={NeuralField}
        durationInFrames={NF_DURATION}
        fps={NF_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={neuralFieldSchema}
        defaultProps={{
          ...neuralFieldDefaults,
          palette: "aurora" as const,
          mirrored: false,
        }}
      />
      <Composition
        id="NeuralFieldAurora4K"
        component={NeuralField}
        durationInFrames={NF_DURATION}
        fps={NF_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={neuralFieldSchema}
        defaultProps={{
          ...neuralFieldDefaults,
          palette: "aurora" as const,
          mirrored: false,
          resolutionScale: 2,
        }}
      />
      <Composition
        id="NeuralFieldNebula"
        component={NeuralField}
        durationInFrames={NF_DURATION}
        fps={NF_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={neuralFieldSchema}
        defaultProps={{
          ...neuralFieldDefaults,
          palette: "nebula" as const,
          mirrored: true,
        }}
      />
      <Composition
        id="NeuralFieldNebula4K"
        component={NeuralField}
        durationInFrames={NF_DURATION}
        fps={NF_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={neuralFieldSchema}
        defaultProps={{
          ...neuralFieldDefaults,
          palette: "nebula" as const,
          mirrored: true,
          resolutionScale: 2,
        }}
      />
    </>
  );
};
