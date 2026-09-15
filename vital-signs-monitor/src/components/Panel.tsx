import React from 'react';
import type {Theme} from '../theme';
import {EcgTrace} from './EcgTrace';
import {Readouts} from './Readouts';

/** Everything that is actually lit on the monitor face. */
export const Panel: React.FC<{theme: Theme}> = ({theme}) => (
  <div style={{position: 'absolute', inset: 0}}>
    <EcgTrace theme={theme} />
    <Readouts theme={theme} />
  </div>
);
