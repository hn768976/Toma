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
  GrowthTimeline,
  growthTimelineSchema,
  growthTimelineChevronDefaults,
  growthTimelineBarsDefaults,
} from "./growth-timeline/GrowthTimeline";
import {
  BASE_WIDTH as GT_WIDTH,
  BASE_HEIGHT as GT_HEIGHT,
  FPS as GT_FPS,
  V1_DURATION_IN_FRAMES,
  V2_DURATION_IN_FRAMES,
} from "./growth-timeline/constants";

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
        id="GrowthTimelineV1"
        component={GrowthTimeline}
        durationInFrames={V1_DURATION_IN_FRAMES}
        fps={GT_FPS}
        width={GT_WIDTH}
        height={GT_HEIGHT}
        schema={growthTimelineSchema}
        defaultProps={growthTimelineChevronDefaults}
      />
      <Composition
        id="GrowthTimelineV1-4K"
        component={GrowthTimeline}
        durationInFrames={V1_DURATION_IN_FRAMES}
        fps={GT_FPS}
        width={GT_WIDTH * 2}
        height={GT_HEIGHT * 2}
        schema={growthTimelineSchema}
        defaultProps={{ ...growthTimelineChevronDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="GrowthTimelineV2"
        component={GrowthTimeline}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={GT_FPS}
        width={GT_WIDTH}
        height={GT_HEIGHT}
        schema={growthTimelineSchema}
        defaultProps={growthTimelineBarsDefaults}
      />
      <Composition
        id="GrowthTimelineV2-4K"
        component={GrowthTimeline}
        durationInFrames={V2_DURATION_IN_FRAMES}
        fps={GT_FPS}
        width={GT_WIDTH * 2}
        height={GT_HEIGHT * 2}
        schema={growthTimelineSchema}
        defaultProps={{ ...growthTimelineBarsDefaults, resolutionScale: 2 }}
      />
    </>
  );
};
