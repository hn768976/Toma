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
  EditorTimeline,
  editorTimelineSchema,
  editorTimelineDefaults,
} from "./editor-timeline/EditorTimeline";
import {
  BASE_WIDTH as EDIT_WIDTH,
  BASE_HEIGHT as EDIT_HEIGHT,
  DURATION_IN_FRAMES as EDIT_DURATION,
  FPS as EDIT_FPS,
} from "./editor-timeline/constants";

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

      {/* Macro shot of a video editor's timeline. Two takes of the same
          setup: A matches the reference framing, B re-stages the panel
          and shoots it from the other side. Each is registered at 1080p
          (the delivered master) and 4K (the archive/regrade master);
          they share one component and differ only by resolutionScale. */}
      <Composition
        id="EditorTimelineA1080"
        component={EditorTimeline}
        durationInFrames={EDIT_DURATION}
        fps={EDIT_FPS}
        width={EDIT_WIDTH}
        height={EDIT_HEIGHT}
        schema={editorTimelineSchema}
        defaultProps={{ ...editorTimelineDefaults, variant: "a" as const }}
      />
      <Composition
        id="EditorTimelineA4K"
        component={EditorTimeline}
        durationInFrames={EDIT_DURATION}
        fps={EDIT_FPS}
        width={EDIT_WIDTH * 2}
        height={EDIT_HEIGHT * 2}
        schema={editorTimelineSchema}
        defaultProps={{
          ...editorTimelineDefaults,
          variant: "a" as const,
          resolutionScale: 2,
        }}
      />
      <Composition
        id="EditorTimelineB1080"
        component={EditorTimeline}
        durationInFrames={EDIT_DURATION}
        fps={EDIT_FPS}
        width={EDIT_WIDTH}
        height={EDIT_HEIGHT}
        schema={editorTimelineSchema}
        defaultProps={{ ...editorTimelineDefaults, variant: "b" as const }}
      />
      <Composition
        id="EditorTimelineB4K"
        component={EditorTimeline}
        durationInFrames={EDIT_DURATION}
        fps={EDIT_FPS}
        width={EDIT_WIDTH * 2}
        height={EDIT_HEIGHT * 2}
        schema={editorTimelineSchema}
        defaultProps={{
          ...editorTimelineDefaults,
          variant: "b" as const,
          resolutionScale: 2,
        }}
      />
    </>
  );
};
