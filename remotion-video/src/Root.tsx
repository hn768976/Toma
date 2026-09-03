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
import { GrungeOverlay, grungeOverlaySchema } from "./grunge/GrungeOverlay";
import {
  WIDTH as GRUNGE_WIDTH,
  HEIGHT as GRUNGE_HEIGHT,
  FPS as GRUNGE_FPS,
  LOOP_FRAMES as GRUNGE_LOOP_FRAMES,
} from "./grunge/constants";

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

      {/* --- Grunge overlays -------------------------------------------- */}
      {/* 4K, 30fps, seamless 30s loop. Composite over footage in screen or
          add blend mode; the near-black base drops out and only the light
          content survives. */}
      <Composition
        id="GrungeDust"
        component={GrungeOverlay}
        durationInFrames={GRUNGE_LOOP_FRAMES}
        fps={GRUNGE_FPS}
        width={GRUNGE_WIDTH}
        height={GRUNGE_HEIGHT}
        schema={grungeOverlaySchema}
        defaultProps={{ variant: "dust" as const }}
      />
      {/* Same overlay rendered on transparency, for editors who would rather
          not use a blend mode. Needs an alpha-capable codec. */}
      <Composition
        id="GrungeDustAlpha"
        component={GrungeOverlay}
        durationInFrames={GRUNGE_LOOP_FRAMES}
        fps={GRUNGE_FPS}
        width={GRUNGE_WIDTH}
        height={GRUNGE_HEIGHT}
        schema={grungeOverlaySchema}
        defaultProps={{ variant: "dust" as const, alpha: true }}
      />
      {/* QA aid: one frame longer than the loop, with grain switched off, so
          `remotion still` can be used to prove frame 900 == frame 0. */}
      <Composition
        id="GrungeLoopCheck"
        component={GrungeOverlay}
        durationInFrames={GRUNGE_LOOP_FRAMES + 1}
        fps={GRUNGE_FPS}
        width={GRUNGE_WIDTH}
        height={GRUNGE_HEIGHT}
        schema={grungeOverlaySchema}
        defaultProps={{ variant: "dust" as const, debugDisableGrain: true }}
      />
    </>
  );
};
