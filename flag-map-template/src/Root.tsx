import React from 'react';
import {Composition, Still} from 'remotion';
import {ROWS} from './data/rows';
import {FlagMap} from './FlagMap';
import {DURATION, FPS} from './scene/layout';
import {FlagSheet} from './sheets/FlagSheet';
import {ShapeSheet} from './sheets/ShapeSheet';

// One composition per data row: FlagMap-<id> (Remotion IDs cannot contain "_"), 3840x2160, 30fps, 12s.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {ROWS.map((row) => (
        <Composition
          key={row.id}
          id={`FlagMap-${row.id}`}
          component={FlagMap}
          defaultProps={{id: row.id}}
          durationInFrames={DURATION}
          fps={FPS}
          width={3840}
          height={2160}
        />
      ))}
      {/* Verification contact sheets (720p). */}
      <Still id="ContactSheet-Flags" component={FlagSheet} width={1280} height={720} />
      <Still id="ContactSheet-Shapes" component={ShapeSheet} width={1280} height={720} />
    </>
  );
};
