import {Composition} from 'remotion';
import {ChipDashboard} from './ChipDashboard';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './config';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* v1 — "violet": flowDirection +1. AI producing outputs. */}
      <Composition
        id="ChipDashboard"
        component={ChipDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'violet' as const}}
      />

      {/* v2 — "teal": flowDirection -1. The same piece, ingesting. */}
      <Composition
        id="ChipDashboardReverse"
        component={ChipDashboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{variant: 'teal' as const}}
      />
    </>
  );
};
