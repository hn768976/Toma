import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import {
  GlassCircles,
  glassCirclesSchema,
  glassCirclesDefaults,
} from "./glass-circles/GlassCircles";
import {
  FPS as GLASS_FPS,
  DURATION_IN_FRAMES as GLASS_DURATION,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
} from "./glass-circles/constants";
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
        id="GlassCircles-V1-1080p"
        component={GlassCircles}
        durationInFrames={GLASS_DURATION}
        fps={GLASS_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={glassCirclesSchema}
        defaultProps={{ ...glassCirclesDefaults, variant: "v1" as const }}
      />
      <Composition
        id="GlassCircles-V1-4K"
        component={GlassCircles}
        durationInFrames={GLASS_DURATION}
        fps={GLASS_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={glassCirclesSchema}
        defaultProps={{ ...glassCirclesDefaults, variant: "v1" as const, supersample: 1 }}
      />
      <Composition
        id="GlassCircles-V2-1080p"
        component={GlassCircles}
        durationInFrames={GLASS_DURATION}
        fps={GLASS_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={glassCirclesSchema}
        defaultProps={{ ...glassCirclesDefaults, variant: "v2" as const }}
      />
      <Composition
        id="GlassCircles-V2-4K"
        component={GlassCircles}
        durationInFrames={GLASS_DURATION}
        fps={GLASS_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={glassCirclesSchema}
        defaultProps={{ ...glassCirclesDefaults, variant: "v2" as const, supersample: 1 }}
      />
    </>
  );
};
