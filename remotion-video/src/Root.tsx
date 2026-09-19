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
  GoldRain,
  goldRainSchema,
  goldRainDefaults,
  CosmicDust,
  cosmicDustSchema,
  cosmicDustDefaults,
  MagentaNebula,
  magentaNebulaSchema,
  magentaNebulaDefaults,
  GoldBand,
  goldBandSchema,
  goldBandDefaults,
  FPS as PLATE_FPS,
  BASE_WIDTH as PLATE_W,
  BASE_HEIGHT as PLATE_H,
  PLATE_DURATION,
} from "./plates";

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
        Four abstract background plates. Each look is registered twice from the
        same component: once at 1920x1080 for delivery and once at 3840x2160.
        The scenes size themselves from the composition width, so the 4K
        composition is the same animation authored at twice the detail rather
        than an upscale.
      */}
      <Composition
        id="GoldRain"
        component={GoldRain}
        durationInFrames={PLATE_DURATION.goldRain}
        fps={PLATE_FPS}
        width={PLATE_W}
        height={PLATE_H}
        schema={goldRainSchema}
        defaultProps={goldRainDefaults}
      />
      <Composition
        id="GoldRain4K"
        component={GoldRain}
        durationInFrames={PLATE_DURATION.goldRain}
        fps={PLATE_FPS}
        width={PLATE_W * 2}
        height={PLATE_H * 2}
        schema={goldRainSchema}
        defaultProps={goldRainDefaults}
      />
      <Composition
        id="CosmicDust"
        component={CosmicDust}
        durationInFrames={PLATE_DURATION.cosmicDust}
        fps={PLATE_FPS}
        width={PLATE_W}
        height={PLATE_H}
        schema={cosmicDustSchema}
        defaultProps={cosmicDustDefaults}
      />
      <Composition
        id="CosmicDust4K"
        component={CosmicDust}
        durationInFrames={PLATE_DURATION.cosmicDust}
        fps={PLATE_FPS}
        width={PLATE_W * 2}
        height={PLATE_H * 2}
        schema={cosmicDustSchema}
        defaultProps={cosmicDustDefaults}
      />
      <Composition
        id="MagentaNebula"
        component={MagentaNebula}
        durationInFrames={PLATE_DURATION.magentaNebula}
        fps={PLATE_FPS}
        width={PLATE_W}
        height={PLATE_H}
        schema={magentaNebulaSchema}
        defaultProps={magentaNebulaDefaults}
      />
      <Composition
        id="MagentaNebula4K"
        component={MagentaNebula}
        durationInFrames={PLATE_DURATION.magentaNebula}
        fps={PLATE_FPS}
        width={PLATE_W * 2}
        height={PLATE_H * 2}
        schema={magentaNebulaSchema}
        defaultProps={magentaNebulaDefaults}
      />
      <Composition
        id="GoldBand"
        component={GoldBand}
        durationInFrames={PLATE_DURATION.goldBand}
        fps={PLATE_FPS}
        width={PLATE_W}
        height={PLATE_H}
        schema={goldBandSchema}
        defaultProps={goldBandDefaults}
      />
      <Composition
        id="GoldBand4K"
        component={GoldBand}
        durationInFrames={PLATE_DURATION.goldBand}
        fps={PLATE_FPS}
        width={PLATE_W * 2}
        height={PLATE_H * 2}
        schema={goldBandSchema}
        defaultProps={goldBandDefaults}
      />
    </>
  );
};
