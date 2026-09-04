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
  PaperRippleRelief,
  paperRippleReliefSchema,
  paperRippleReliefDefaults,
} from "./paper-ripple/PaperRippleRelief";
import {
  BASE_WIDTH as RIPPLE_WIDTH,
  BASE_HEIGHT as RIPPLE_HEIGHT,
  DURATION_IN_FRAMES as RIPPLE_DURATION_IN_FRAMES,
  FPS as RIPPLE_FPS,
} from "./paper-ripple/constants";

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
        id="PaperRippleWhite"
        component={PaperRippleRelief}
        durationInFrames={RIPPLE_DURATION_IN_FRAMES}
        fps={RIPPLE_FPS}
        width={RIPPLE_WIDTH}
        height={RIPPLE_HEIGHT}
        schema={paperRippleReliefSchema}
        defaultProps={{ ...paperRippleReliefDefaults, variant: "white" }}
      />
      <Composition
        id="PaperRippleGraphite"
        component={PaperRippleRelief}
        durationInFrames={RIPPLE_DURATION_IN_FRAMES}
        fps={RIPPLE_FPS}
        width={RIPPLE_WIDTH}
        height={RIPPLE_HEIGHT}
        schema={paperRippleReliefSchema}
        defaultProps={{ ...paperRippleReliefDefaults, variant: "graphite" }}
      />
    </>
  );
};
