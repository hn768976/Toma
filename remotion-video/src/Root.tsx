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
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
  WIDTH as RING_WIDTH,
  HEIGHT as RING_HEIGHT,
} from "./particle-ring/constants";
import {
  HeadlineScroll,
  headlineScrollSchema,
  headlineScrollDefaults,
} from "./headline-scroll/HeadlineScroll";
import {
  DURATION_IN_FRAMES as HEADLINE_DURATION_IN_FRAMES,
  FPS as HEADLINE_FPS,
  WIDTH as HEADLINE_WIDTH,
  HEIGHT as HEADLINE_HEIGHT,
} from "./headline-scroll/constants";

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
        width={RING_WIDTH}
        height={RING_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="HeadlineScroll"
        component={HeadlineScroll}
        durationInFrames={HEADLINE_DURATION_IN_FRAMES}
        fps={HEADLINE_FPS}
        width={HEADLINE_WIDTH}
        height={HEADLINE_HEIGHT}
        schema={headlineScrollSchema}
        defaultProps={headlineScrollDefaults}
      />
    </>
  );
};
