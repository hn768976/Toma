import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Panel} from './components/Panel';
import {ScreenFx, Vignette} from './components/ScreenFx';
import {DESIGN_H, DESIGN_W} from './constants';
import './load-fonts';
import {RED, TEAL, type Theme} from './theme';

export type MonitorProps = {
  variant: 'teal' | 'red';
};

const THEMES: Record<MonitorProps['variant'], Theme> = {teal: TEAL, red: RED};

export const Monitor: React.FC<MonitorProps> = ({variant}) => {
  const theme = THEMES[variant];
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();

  // One design-space layout, scaled to whatever resolution is rendering.
  const scale = width / DESIGN_W;

  // Barely-there handheld drift so the macro shot never feels locked off.
  const t = frame / 30;
  const driftX = Math.sin(t * 0.47) * 5 + Math.sin(t * 1.13 + 1.2) * 1.6;
  const driftY = Math.cos(t * 0.39 + 0.6) * 4 + Math.sin(t * 0.97) * 1.3;
  const breathe = 1.055 + Math.sin(t * 0.31) * 0.006;
  const roll = -0.35 + Math.sin(t * 0.28 + 0.4) * 0.12;

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <AbsoluteFill style={{perspective: 4000 * scale, overflow: 'hidden'}}>
        <AbsoluteFill
          style={{
            transform:
              `translate(${driftX * scale}px, ${driftY * scale}px) ` +
              `scale(${breathe}) rotateY(-2.2deg) rotateZ(${roll}deg)`,
            transformOrigin: '50% 50%',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DESIGN_W,
              height: DESIGN_H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <Panel theme={theme} />

            {/* Bloom: a heavily defocused copy added back over the original. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                mixBlendMode: 'screen',
                filter: 'blur(26px)',
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            >
              <Panel theme={theme} />
            </div>

            <ScreenFx />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <Vignette />
    </AbsoluteFill>
  );
};
