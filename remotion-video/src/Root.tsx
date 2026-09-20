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
  GlassCardsFan,
  glassCardsFanSchema,
  glassCardsFanDefaults,
} from "./glass/GlassCardsFan";
import {
  GlassPanesRow,
  glassPanesRowSchema,
  glassPanesRowDefaults,
} from "./glass/GlassPanesRow";
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
        id="GlassPanesRow-V1-1080p"
        component={GlassPanesRow}
        durationInFrames={V1_DURATION_IN_FRAMES}
        fps={GLASS_FPS}
        width={GLASS_WIDTH}
        height={GLASS_HEIGHT}
        schema={glassPanesRowSchema}
        defaultProps={glassPanesRowDefaults}
      />
      <Composition
        id="GlassPanesRow-V1-4K"
        component={GlassPanesRow}
        durationInFrames={V1_DURATION_IN_FRAMES}
        fps={GLASS_FPS}
        width={GLASS_WIDTH * 2}
        height={GLASS_HEIGHT * 2}
        schema={glassPanesRowSchema}
        defaultProps={glassPanesRowDefaults}
      />
      <Composition
        id="GlassCardsFan-V2-1080p"
        component={GlassCardsFan}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={GLASS_FPS}
        width={GLASS_WIDTH}
        height={GLASS_HEIGHT}
        schema={glassCardsFanSchema}
        defaultProps={glassCardsFanDefaults}
      />
      <Composition
        id="GlassCardsFan-V2-4K"
        component={GlassCardsFan}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={GLASS_FPS}
        width={GLASS_WIDTH * 2}
        height={GLASS_HEIGHT * 2}
        schema={glassCardsFanSchema}
        defaultProps={glassCardsFanDefaults}
      />
    </>
  );
};
