import "./index.css";
import "./load-fonts";
import "./ai-data-stream/fonts";
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
  AiDataStream,
  aiDataStreamSchema,
  aiDataStreamDefaults,
} from "./ai-data-stream/AiDataStream";
import {
  BASE_WIDTH as STREAM_BASE_WIDTH,
  BASE_HEIGHT as STREAM_BASE_HEIGHT,
  DURATION_IN_FRAMES as STREAM_DURATION_IN_FRAMES,
  FPS as STREAM_FPS,
} from "./ai-data-stream/constants";

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
      {/* AI data-stream text field: dark and light, at 1080p and 4K. */}
      {(["dark", "light"] as const).map((theme) =>
        ([1, 2] as const).map((resolutionScale) => (
          <Composition
            key={`${theme}-${resolutionScale}`}
            id={`AiDataStream${theme === "dark" ? "Dark" : "Light"}${resolutionScale === 2 ? "4K" : ""}`}
            component={AiDataStream}
            durationInFrames={STREAM_DURATION_IN_FRAMES}
            fps={STREAM_FPS}
            width={STREAM_BASE_WIDTH * resolutionScale}
            height={STREAM_BASE_HEIGHT * resolutionScale}
            schema={aiDataStreamSchema}
            defaultProps={{ ...aiDataStreamDefaults, theme, resolutionScale }}
          />
        )),
      )}
    </>
  );
};
