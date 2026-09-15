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
  GlassTwist,
  glassTwistSchema,
  glassTwistDefaults,
} from "./glass-twist/GlassTwist";
import {
  BASE_WIDTH as TWIST_WIDTH,
  BASE_HEIGHT as TWIST_HEIGHT,
  DURATION_IN_FRAMES as TWIST_DURATION_IN_FRAMES,
  FPS as TWIST_FPS,
} from "./glass-twist/constants";

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
        The glass twist loop. Four compositions: each of the two colour
        variants at 1080p (the delivered masters) and at 4K (rendered
        from the same code, for anyone who needs the larger master).
      */}
      <Composition
        id="GlassTwistEmerald"
        component={GlassTwist}
        durationInFrames={TWIST_DURATION_IN_FRAMES}
        fps={TWIST_FPS}
        width={TWIST_WIDTH}
        height={TWIST_HEIGHT}
        schema={glassTwistSchema}
        defaultProps={{ ...glassTwistDefaults, variant: "emerald" as const }}
      />
      <Composition
        id="GlassTwistAzureMirror"
        component={GlassTwist}
        durationInFrames={TWIST_DURATION_IN_FRAMES}
        fps={TWIST_FPS}
        width={TWIST_WIDTH}
        height={TWIST_HEIGHT}
        schema={glassTwistSchema}
        defaultProps={{ ...glassTwistDefaults, variant: "azure" as const }}
      />
      <Composition
        id="GlassTwistEmerald4K"
        component={GlassTwist}
        durationInFrames={TWIST_DURATION_IN_FRAMES}
        fps={TWIST_FPS}
        width={TWIST_WIDTH * 2}
        height={TWIST_HEIGHT * 2}
        schema={glassTwistSchema}
        defaultProps={{ variant: "emerald" as const }}
      />
      <Composition
        id="GlassTwistAzureMirror4K"
        component={GlassTwist}
        durationInFrames={TWIST_DURATION_IN_FRAMES}
        fps={TWIST_FPS}
        width={TWIST_WIDTH * 2}
        height={TWIST_HEIGHT * 2}
        schema={glassTwistSchema}
        defaultProps={{ variant: "azure" as const }}
      />
    </>
  );
};
