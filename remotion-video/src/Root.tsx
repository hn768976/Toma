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
  GlobalNetwork,
  globalNetworkSchema,
} from "./global-network/GlobalNetwork";
import {
  DURATION_IN_FRAMES as NET_DURATION_IN_FRAMES,
  FPS as NET_FPS,
  WIDTH as NET_WIDTH,
  HEIGHT as NET_HEIGHT,
} from "./global-network/constants";

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

      {/* Global-network motion graphic. The artwork is one 1920x1080
          vector scene stretched to the composition size, so the 4K
          compositions are exact upscales of the 1080p ones — same
          framing, same timing, same particle counts. Deliver from the
          1080p ids; hand off the 4K ids in the project. */}
      <Composition
        id="GlobalNetwork"
        component={GlobalNetwork}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_WIDTH}
        height={NET_HEIGHT}
        schema={globalNetworkSchema}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="GlobalNetwork4K"
        component={GlobalNetwork}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_WIDTH * 2}
        height={NET_HEIGHT * 2}
        schema={globalNetworkSchema}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="GlobalNetworkBlue"
        component={GlobalNetwork}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_WIDTH}
        height={NET_HEIGHT}
        schema={globalNetworkSchema}
        defaultProps={{ variant: "darkBlue" as const }}
      />
      <Composition
        id="GlobalNetworkBlue4K"
        component={GlobalNetwork}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_WIDTH * 2}
        height={NET_HEIGHT * 2}
        schema={globalNetworkSchema}
        defaultProps={{ variant: "darkBlue" as const }}
      />
    </>
  );
};
