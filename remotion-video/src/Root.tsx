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
  LightBurst,
  lightBurstDefaults,
  lightBurstSchema,
} from "./light-burst/LightBurst";
import {
  BASE_WIDTH as BURST_WIDTH,
  BASE_HEIGHT as BURST_HEIGHT,
  DURATION_IN_FRAMES as BURST_DURATION_IN_FRAMES,
  FPS as BURST_FPS,
} from "./light-burst/constants";
import { BLUE, GOLD, MAGENTA } from "./light-burst/palettes";

// The three light-burst colourways. Identical choreography, identical
// timing — only the palette changes. Compositions are defined at 3840x2160
// so they can be mastered at 4K; render the preview with --scale=0.5.
//
// Ids use "-" where the delivered filenames use "_": Remotion only allows
// a-z, A-Z, 0-9 and "-" in a composition id.
const LIGHT_BURSTS = [
  { id: "V1-LightBurstGold", palette: GOLD },
  { id: "V2-LightBurstBlue", palette: BLUE },
  { id: "V3-LightBurstMagenta", palette: MAGENTA },
];

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
      {LIGHT_BURSTS.map(({ id, palette }) => (
        <Composition
          key={id}
          id={id}
          component={LightBurst}
          durationInFrames={BURST_DURATION_IN_FRAMES}
          fps={BURST_FPS}
          width={BURST_WIDTH}
          height={BURST_HEIGHT}
          schema={lightBurstSchema}
          defaultProps={{ ...lightBurstDefaults, palette }}
        />
      ))}
    </>
  );
};
