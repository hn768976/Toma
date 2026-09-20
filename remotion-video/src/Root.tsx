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
  GlassCardsRing,
  glassCardsRingSchema,
  glassCardsRingDefaults,
} from "./glass/GlassCardsRing";
import {
  GlassPanesRing,
  glassPanesRingSchema,
  glassPanesRingDefaults,
} from "./glass/GlassPanesRing";
import {
  BASE_WIDTH as GLASS_WIDTH,
  BASE_HEIGHT as GLASS_HEIGHT,
  FPS as GLASS_FPS,
  V1_DURATION_IN_FRAMES,
  V2_DURATION_IN_FRAMES,
} from "./glass/constants";

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
        id="GlassPanesRing-V1-1080p"
        component={GlassPanesRing}
        durationInFrames={V1_DURATION_IN_FRAMES}
        fps={GLASS_FPS}
        width={GLASS_WIDTH}
        height={GLASS_HEIGHT}
        schema={glassPanesRingSchema}
        defaultProps={glassPanesRingDefaults}
      />
      <Composition
        id="GlassPanesRing-V1-4K"
        component={GlassPanesRing}
        durationInFrames={V1_DURATION_IN_FRAMES}
        fps={GLASS_FPS}
        width={GLASS_WIDTH * 2}
        height={GLASS_HEIGHT * 2}
        schema={glassPanesRingSchema}
        defaultProps={glassPanesRingDefaults}
      />
      <Composition
        id="GlassCardsRing-V2-1080p"
        component={GlassCardsRing}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={GLASS_FPS}
        width={GLASS_WIDTH}
        height={GLASS_HEIGHT}
        schema={glassCardsRingSchema}
        defaultProps={glassCardsRingDefaults}
      />
      <Composition
        id="GlassCardsRing-V2-4K"
        component={GlassCardsRing}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={GLASS_FPS}
        width={GLASS_WIDTH * 2}
        height={GLASS_HEIGHT * 2}
        schema={glassCardsRingSchema}
        defaultProps={glassCardsRingDefaults}
      />
    </>
  );
};
