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
  NewspaperHeadline,
  newspaperHeadlineSchema,
  newspaperHeadlineDefaults,
} from "./newspaper/NewspaperHeadline";
import {
  DURATION_IN_FRAMES as NEWS_DURATION_IN_FRAMES,
  FPS as NEWS_FPS,
  WIDTH as NEWS_WIDTH,
  HEIGHT as NEWS_HEIGHT,
} from "./newspaper/constants";

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
      {/* Authored at 4K. Render the 1080p deliverable with --scale=0.5. */}
      <Composition
        id="NewspaperHeadline4K"
        component={NewspaperHeadline}
        durationInFrames={NEWS_DURATION_IN_FRAMES}
        fps={NEWS_FPS}
        width={NEWS_WIDTH}
        height={NEWS_HEIGHT}
        schema={newspaperHeadlineSchema}
        defaultProps={newspaperHeadlineDefaults}
      />
      <Composition
        id="NewspaperHeadlineOrbit4K"
        component={NewspaperHeadline}
        durationInFrames={NEWS_DURATION_IN_FRAMES}
        fps={NEWS_FPS}
        width={NEWS_WIDTH}
        height={NEWS_HEIGHT}
        schema={newspaperHeadlineSchema}
        defaultProps={{ ...newspaperHeadlineDefaults, cameraMove: "orbit" }}
      />
    </>
  );
};
