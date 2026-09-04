import React from 'react';
import {AbsoluteFill} from 'remotion';
import {FocusStack} from './FocusStack';
import {Grain} from './Grain';
import './fonts';
import * as L from './layout';
import type {Theme} from './theme';

export const MetricsCounter: React.FC<{theme: Theme}> = ({theme}) => {
  const [bandTop, bandBottom] = L.SHARP_BAND;
  const bandCentre = ((bandTop + bandBottom) / 2) * 100;

  return (
    <AbsoluteFill style={{backgroundColor: theme.surface}}>
      <FocusStack theme={theme} />

      {/* A faint cool glow behind the sharp band only — V2. */}
      {theme.glow ? (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(ellipse 62% 15% at 50% ${bandCentre}%, ${theme.glow} 0%, rgba(0,0,0,0) 100%)`,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}

      {theme.vignette ? (
        <AbsoluteFill
          style={{
            backgroundImage:
              'radial-gradient(ellipse 78% 72% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.30) 78%, rgba(0,0,0,0.62) 100%)',
          }}
        />
      ) : null}

      <Grain opacity={theme.grain} />
    </AbsoluteFill>
  );
};
