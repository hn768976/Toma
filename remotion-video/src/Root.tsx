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
import { GeoHud } from "./geo-hud/GeoHud";
import { GeoHudTilted } from "./geo-hud/GeoHudTilted";
import {
  DURATION_IN_FRAMES as HUD_DURATION,
  FPS as HUD_FPS,
  HEIGHT as HUD_HEIGHT,
  WIDTH as HUD_WIDTH,
} from "./geo-hud/constants";
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
        id="GeoHudBlue"
        component={GeoHud}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="GeoHudGreen"
        component={GeoHud}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        defaultProps={{ variant: "green" as const }}
      />
      <Composition
        id="GeoHudTilted"
        component={GeoHudTilted}
        durationInFrames={HUD_DURATION}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        defaultProps={{ variant: "tilted" as const }}
      />
      {/* QA only: 901 frames so frames 0 and 900 can be compared to prove the
          loop closes. Not part of the deliverables. */}
      <Composition
        id="GeoHudLoopCheck"
        component={GeoHud}
        durationInFrames={HUD_DURATION + 1}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="GeoHudTiltedLoopCheck"
        component={GeoHudTilted}
        durationInFrames={HUD_DURATION + 1}
        fps={HUD_FPS}
        width={HUD_WIDTH}
        height={HUD_HEIGHT}
        defaultProps={{ variant: "tilted" as const }}
      />
    </>
  );
};
