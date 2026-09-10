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
  ZodiacTunnel,
  zodiacTunnelSchema,
  zodiacTunnelDefaults,
} from "./zodiac-tunnel/ZodiacTunnel";
import {
  BASE_WIDTH as ZODIAC_BASE_WIDTH,
  BASE_HEIGHT as ZODIAC_BASE_HEIGHT,
  DURATION_IN_FRAMES as ZODIAC_DURATION_IN_FRAMES,
  FPS as ZODIAC_FPS,
} from "./zodiac-tunnel/constants";

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
        Both zodiac compositions are authored at 4K. Deliverable previews
        come out of `--scale=0.5` (1920x1080); pass `--scale=1` for the
        full-resolution master.
      */}
      <Composition
        id="ZodiacTunnelChalk"
        component={ZodiacTunnel}
        durationInFrames={ZODIAC_DURATION_IN_FRAMES}
        fps={ZODIAC_FPS}
        width={ZODIAC_BASE_WIDTH * 2}
        height={ZODIAC_BASE_HEIGHT * 2}
        schema={zodiacTunnelSchema}
        defaultProps={{ ...zodiacTunnelDefaults, theme: "chalk" as const }}
      />
      <Composition
        id="ZodiacTunnelLoopTest"
        component={ZodiacTunnel}
        durationInFrames={ZODIAC_DURATION_IN_FRAMES + 1}
        fps={ZODIAC_FPS}
        width={ZODIAC_BASE_WIDTH * 2}
        height={ZODIAC_BASE_HEIGHT * 2}
        schema={zodiacTunnelSchema}
        defaultProps={{ ...zodiacTunnelDefaults, theme: "chalk" as const }}
      />
      <Composition
        id="ZodiacTunnelGold"
        component={ZodiacTunnel}
        durationInFrames={ZODIAC_DURATION_IN_FRAMES}
        fps={ZODIAC_FPS}
        width={ZODIAC_BASE_WIDTH * 2}
        height={ZODIAC_BASE_HEIGHT * 2}
        schema={zodiacTunnelSchema}
        defaultProps={{ ...zodiacTunnelDefaults, theme: "gold" as const }}
      />
    </>
  );
};
