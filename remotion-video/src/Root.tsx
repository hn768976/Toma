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
  InkDiffusion,
  inkDiffusionSchema,
  inkDiffusionDefaults,
} from "./ink-diffusion/InkDiffusion";
import {
  DURATION_IN_FRAMES as INK_DURATION_IN_FRAMES,
  FPS as INK_FPS,
  WIDTH as INK_WIDTH,
  HEIGHT as INK_HEIGHT,
} from "./ink-diffusion/constants";

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
        "Ink Diffusion" — three versions of the same simulation, authored at
        4K so they can be rendered at full size later. The 1080p deliverables
        come from `--scale=0.5`, which changes only the device pixel ratio.
      */}
      <Composition
        id="V1-InkBlackOnWhite"
        component={InkDiffusion}
        durationInFrames={INK_DURATION_IN_FRAMES}
        fps={INK_FPS}
        width={INK_WIDTH}
        height={INK_HEIGHT}
        schema={inkDiffusionSchema}
        defaultProps={{ ...inkDiffusionDefaults, variant: "black-on-white" as const, seed: 1 }}
      />
      <Composition
        id="V2-InkColourOnBlack"
        component={InkDiffusion}
        durationInFrames={INK_DURATION_IN_FRAMES}
        fps={INK_FPS}
        width={INK_WIDTH}
        height={INK_HEIGHT}
        schema={inkDiffusionSchema}
        defaultProps={{ ...inkDiffusionDefaults, variant: "colour-on-black" as const, seed: 1 }}
      />
      <Composition
        id="V3-MilkInWater"
        component={InkDiffusion}
        durationInFrames={INK_DURATION_IN_FRAMES}
        fps={INK_FPS}
        width={INK_WIDTH}
        height={INK_HEIGHT}
        schema={inkDiffusionSchema}
        defaultProps={{ ...inkDiffusionDefaults, variant: "milk" as const, seed: 1 }}
      />
    </>
  );
};
