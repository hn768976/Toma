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
  FiberOptics,
  fiberOpticsSchema,
  fiberOpticsDefaults,
} from "./fiber-optics/FiberOptics";
import {
  FPS as FIBER_FPS,
  DURATION_IN_FRAMES as FIBER_DURATION_IN_FRAMES,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
} from "./fiber-optics/constants";

// The two colourways x the two delivery sizes. All four share one component,
// one scene graph and one 300-frame timeline; only palette and pixel count
// differ, so the 4K master and the 1080p deliverable cannot drift apart.
const FIBER_OPTICS_COMPOSITIONS = [
  { id: "FiberOptics4K", variant: "blue", width: UHD_WIDTH, height: UHD_HEIGHT },
  { id: "FiberOptics1080", variant: "blue", width: HD_WIDTH, height: HD_HEIGHT },
  { id: "FiberOpticsViolet4K", variant: "violet", width: UHD_WIDTH, height: UHD_HEIGHT },
  { id: "FiberOpticsViolet1080", variant: "violet", width: HD_WIDTH, height: HD_HEIGHT },
] as const;

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
      {FIBER_OPTICS_COMPOSITIONS.map(({ id, variant, width, height }) => (
        <Composition
          key={id}
          id={id}
          component={FiberOptics}
          durationInFrames={FIBER_DURATION_IN_FRAMES}
          fps={FIBER_FPS}
          width={width}
          height={height}
          schema={fiberOpticsSchema}
          defaultProps={{ ...fiberOpticsDefaults, variant }}
        />
      ))}
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
    </>
  );
};
