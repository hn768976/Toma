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
  PlexusTunnel,
  plexusTunnelSchema,
  plexusTunnelDefaults,
} from "./plexus/PlexusTunnel";
import {
  BASE_WIDTH as PLEXUS_WIDTH,
  BASE_HEIGHT as PLEXUS_HEIGHT,
  DURATION_IN_FRAMES as PLEXUS_DURATION_IN_FRAMES,
  FPS as PLEXUS_FPS,
} from "./plexus/constants";

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
      {/* Plexus tunnel. Each theme ships at 1080p for delivery and 4K
          for re-rendering; the component derives its scale from the
          composition width, so the pairs stay in sync. */}
      <Composition
        id="PlexusTunnelLight"
        component={PlexusTunnel}
        durationInFrames={PLEXUS_DURATION_IN_FRAMES}
        fps={PLEXUS_FPS}
        width={PLEXUS_WIDTH}
        height={PLEXUS_HEIGHT}
        schema={plexusTunnelSchema}
        defaultProps={{ ...plexusTunnelDefaults, theme: "light" as const }}
      />
      <Composition
        id="PlexusTunnelLight4K"
        component={PlexusTunnel}
        durationInFrames={PLEXUS_DURATION_IN_FRAMES}
        fps={PLEXUS_FPS}
        width={PLEXUS_WIDTH * 2}
        height={PLEXUS_HEIGHT * 2}
        schema={plexusTunnelSchema}
        defaultProps={{ ...plexusTunnelDefaults, theme: "light" as const }}
      />
      <Composition
        id="PlexusTunnelDark"
        component={PlexusTunnel}
        durationInFrames={PLEXUS_DURATION_IN_FRAMES}
        fps={PLEXUS_FPS}
        width={PLEXUS_WIDTH}
        height={PLEXUS_HEIGHT}
        schema={plexusTunnelSchema}
        defaultProps={{ ...plexusTunnelDefaults, theme: "dark" as const }}
      />
      <Composition
        id="PlexusTunnelDark4K"
        component={PlexusTunnel}
        durationInFrames={PLEXUS_DURATION_IN_FRAMES}
        fps={PLEXUS_FPS}
        width={PLEXUS_WIDTH * 2}
        height={PLEXUS_HEIGHT * 2}
        schema={plexusTunnelSchema}
        defaultProps={{ ...plexusTunnelDefaults, theme: "dark" as const }}
      />
    </>
  );
};
