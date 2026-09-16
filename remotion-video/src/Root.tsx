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
  HalftoneDots,
  halftoneDotsSchema,
  halftoneDotsDefaults,
} from "./halftone/HalftoneDots";
import {
  FPS as HALFTONE_FPS,
  DURATION_IN_FRAMES as HALFTONE_DURATION_IN_FRAMES,
  UHD_WIDTH,
  UHD_HEIGHT,
  HD_WIDTH,
  HD_HEIGHT,
} from "./halftone/constants";

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
        Halftone dot motion background. The 4K comps are the masters; the 1080p
        comps are the same picture at half scale (the lattice pitch is derived
        from the frame height), so they can be rendered or up-issued at will.
      */}
      <Composition
        id="HalftoneDots4K"
        component={HalftoneDots}
        durationInFrames={HALFTONE_DURATION_IN_FRAMES}
        fps={HALFTONE_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={halftoneDotsSchema}
        defaultProps={{ ...halftoneDotsDefaults, variant: "mono" as const }}
      />
      <Composition
        id="HalftoneDotsBlue4K"
        component={HalftoneDots}
        durationInFrames={HALFTONE_DURATION_IN_FRAMES}
        fps={HALFTONE_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={halftoneDotsSchema}
        defaultProps={{ ...halftoneDotsDefaults, variant: "blue" as const }}
      />
      <Composition
        id="HalftoneDots1080"
        component={HalftoneDots}
        durationInFrames={HALFTONE_DURATION_IN_FRAMES}
        fps={HALFTONE_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={halftoneDotsSchema}
        defaultProps={{ ...halftoneDotsDefaults, variant: "mono" as const }}
      />
      <Composition
        id="HalftoneDotsBlue1080"
        component={HalftoneDots}
        durationInFrames={HALFTONE_DURATION_IN_FRAMES}
        fps={HALFTONE_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={halftoneDotsSchema}
        defaultProps={{ ...halftoneDotsDefaults, variant: "blue" as const }}
      />
    </>
  );
};
