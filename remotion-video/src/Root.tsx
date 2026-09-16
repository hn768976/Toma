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
  SpiralFlow,
  spiralFlowSchema,
  spiralFlowDefaults,
} from "./spiral-flow/SpiralFlow";
import {
  FPS as SPIRAL_FPS,
  DURATION_IN_FRAMES as SPIRAL_DURATION_IN_FRAMES,
  UHD_WIDTH,
  UHD_HEIGHT,
  HD_WIDTH,
  HD_HEIGHT,
} from "./spiral-flow/constants";

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
        Spiral Flow — 6.000 s seamless loop at 30 fps, matching the reference
        clip's runtime exactly. UHD is the master; the HD pair exists so the
        1080p deliverables can be checked without a downscale step.

        The UHD pair runs fewer MSAA samples than the HD pair, not more: at 4K
        the scene pass and its blur taps dominate memory, and a software GL
        driver will drop the device part-way through a long sequence if pushed.
        Four times the pixels already resolves the tube silhouettes better than
        extra samples at 1080p would, and the delivery downscale averages four
        rendered pixels into every output one on top of that.
      */}
      <Composition
        id="SpiralFlow-4K-Violet"
        component={SpiralFlow}
        durationInFrames={SPIRAL_DURATION_IN_FRAMES}
        fps={SPIRAL_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={spiralFlowSchema}
        defaultProps={{
          ...spiralFlowDefaults,
          grade: "violet",
          meshDetail: 1.15,
          samples: 2,
        }}
      />
      <Composition
        id="SpiralFlow-4K-Blue"
        component={SpiralFlow}
        durationInFrames={SPIRAL_DURATION_IN_FRAMES}
        fps={SPIRAL_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={spiralFlowSchema}
        defaultProps={{
          ...spiralFlowDefaults,
          grade: "blue",
          meshDetail: 1.15,
          samples: 2,
        }}
      />
      <Composition
        id="SpiralFlow-1080-Violet"
        component={SpiralFlow}
        durationInFrames={SPIRAL_DURATION_IN_FRAMES}
        fps={SPIRAL_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={spiralFlowSchema}
        defaultProps={{ ...spiralFlowDefaults, grade: "violet" }}
      />
      <Composition
        id="SpiralFlow-1080-Blue"
        component={SpiralFlow}
        durationInFrames={SPIRAL_DURATION_IN_FRAMES}
        fps={SPIRAL_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={spiralFlowSchema}
        defaultProps={{ ...spiralFlowDefaults, grade: "blue" }}
      />
    </>
  );
};
