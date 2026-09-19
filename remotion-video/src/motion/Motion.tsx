import { Composition } from "remotion";
import { MosaicBlocks } from "./scenes/MosaicBlocks";
import { SpeedStreaks } from "./scenes/SpeedStreaks";
import { MonoBars } from "./scenes/MonoBars";
import { ConfettiBlocks } from "./scenes/ConfettiBlocks";
import {
  MOTION_FPS,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
  MOSAIC_DURATION,
  STREAKS_DURATION,
  BARS_DURATION,
  BLOCKS_DURATION,
} from "./constants";

/**
 * The four versions, each registered twice: a 1920x1080 delivery composition
 * and a 3840x2160 mastering composition. The scenes are resolution
 * independent, so both ids render pixel-for-pixel the same framing.
 */
const VERSIONS = [
  { id: "V1-Mosaic", component: MosaicBlocks, duration: MOSAIC_DURATION },
  { id: "V2-Streaks", component: SpeedStreaks, duration: STREAKS_DURATION },
  { id: "V3-Bars", component: MonoBars, duration: BARS_DURATION },
  { id: "V4-Blocks", component: ConfettiBlocks, duration: BLOCKS_DURATION },
] as const;

export const MotionCompositions: React.FC = () => (
  <>
    {VERSIONS.map(({ id, component, duration }) => (
      <Composition
        key={id}
        id={id}
        component={component}
        durationInFrames={duration}
        fps={MOTION_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
      />
    ))}
    {VERSIONS.map(({ id, component, duration }) => (
      <Composition
        key={`${id}-4K`}
        id={`${id}-4K`}
        component={component}
        durationInFrames={duration}
        fps={MOTION_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
      />
    ))}
  </>
);
