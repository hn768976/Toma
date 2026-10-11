import React from 'react';
import {Composition, Still} from 'remotion';
import {DIRECTIONS, ROWS, type Direction} from './data/rows';
import {FlagChart} from './FlagChart';
import {DURATION, FPS} from './scene/layout';
import {ChartSheet} from './sheets/ChartSheet';
import {FlagSheet} from './sheets/FlagSheet';

// Two compositions per data row: FlagChart-<id>-Growth and FlagChart-<id>-Decline
// (Remotion IDs cannot contain "_"), 3840x2160, 30fps, 12s.
export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.flatMap((row) =>
      (Object.keys(DIRECTIONS) as Direction[]).map((dir) => (
        <Composition
          key={`${row.id}-${dir}`}
          id={`FlagChart-${row.id}-${dir}`}
          component={FlagChart}
          defaultProps={{id: row.id, dir}}
          durationInFrames={DURATION}
          fps={FPS}
          width={3840}
          height={2160}
        />
      )),
    )}
    {/* Verification / delivery contact sheets (720p). */}
    <Still id="ContactSheet-Flags" component={FlagSheet} defaultProps={{anonymous: false}} width={1280} height={720} />
    <Still id="ContactSheet-Flags-Numbered" component={FlagSheet} defaultProps={{anonymous: true}} width={1280} height={720} />
    <Still id="ContactSheet-Growth" component={ChartSheet} defaultProps={{dir: 'Growth' as Direction}} width={1280} height={720} />
    <Still id="ContactSheet-Decline" component={ChartSheet} defaultProps={{dir: 'Decline' as Direction}} width={1280} height={720} />
  </>
);
