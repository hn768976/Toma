import React from 'react';
import { Composition } from 'remotion';
import { ROWS } from './data';
import { Look } from './Look';

export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id.replace('_', '-')}
        component={Look}
        fps={30}
        width={3840}
        height={2160}
        durationInFrames={row.frames}
        defaultProps={{ row } as { row: typeof row; durationOverride?: number }}
        // durationOverride lets the loop check render a 601-frame version
        calculateMetadata={({ props }) => ({
          durationInFrames: props.durationOverride ?? row.frames,
        })}
      />
    ))}
  </>
);
