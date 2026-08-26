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
  ParticleRain,
  particleRainSchema,
  particleRainDefaults,
} from "./particle-rain/ParticleRain";
import {
  DURATION_IN_FRAMES as RAIN_DURATION_IN_FRAMES,
  FPS as RAIN_FPS,
  WIDTH as RAIN_WIDTH,
  HEIGHT as RAIN_HEIGHT,
} from "./particle-rain/constants";

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
        id="ParticleRain"
        component={ParticleRain}
        durationInFrames={RAIN_DURATION_IN_FRAMES}
        fps={RAIN_FPS}
        width={RAIN_WIDTH}
        height={RAIN_HEIGHT}
        schema={particleRainSchema}
        defaultProps={particleRainDefaults}
      />
    </>
  );
};
