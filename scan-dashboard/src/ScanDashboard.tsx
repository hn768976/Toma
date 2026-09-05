import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { PERSPECTIVE, PLANE_H, PLANE_W, RAKE } from './constants';
import { Grain } from './components/Grain';
import { PlaneContent } from './components/Plane';
import { loopSin } from './motion';
import type { Theme } from './theme';

/**
 * Depth of field is faked in screen space: the sharp plane is masked out along
 * the top of frame and a blurred copy is masked in, so the far edge softens
 * while the mid band stays crisp.
 */
const SHARP_MASK =
  'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 5%, #000 27%, #000 100%)';
const SOFT_MASK =
  'linear-gradient(to bottom, #000 0%, #000 5%, rgba(0,0,0,0) 27%, rgba(0,0,0,0) 100%)';

const planeStyle = (frame: number): React.CSSProperties => {
  // A very slight drift that returns to where it started.
  const rake = RAKE + 0.55 * loopSin(frame, 1);
  const roll = 0.14 * loopSin(frame, 1, Math.PI / 3);
  const dx = 20 * loopSin(frame, 1, Math.PI / 2);
  const dy = 14 * loopSin(frame, 2);
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: PLANE_W,
    height: PLANE_H,
    marginLeft: -PLANE_W / 2,
    marginTop: -PLANE_H / 2,
    transform: `translate3d(${dx}px, ${dy}px, 0) rotateX(${rake}deg) rotateZ(${roll}deg)`,
    transformStyle: 'preserve-3d',
  };
};

export const ScanDashboard: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const plane = planeStyle(frame);
  const stage: React.CSSProperties = {
    perspective: PERSPECTIVE,
    perspectiveOrigin: '50% 50%',
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bgEdge,
        backgroundImage: `radial-gradient(ellipse 80% 70% at 50% 46%, ${theme.bgCentre} 0%, ${theme.bgEdge} 100%)`,
        overflow: 'hidden',
      }}
    >
      {/* Sharp plane. */}
      <AbsoluteFill style={{ maskImage: SHARP_MASK, WebkitMaskImage: SHARP_MASK }}>
        <AbsoluteFill style={stage}>
          <div style={plane}>
            <PlaneContent theme={theme} frame={frame} idPrefix={`${theme.id}-sharp`} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Softened far edge. */}
      <AbsoluteFill
        style={{ maskImage: SOFT_MASK, WebkitMaskImage: SOFT_MASK, filter: 'blur(12px)' }}
      >
        <AbsoluteFill style={stage}>
          <div style={plane}>
            <PlaneContent theme={theme} frame={frame} idPrefix={`${theme.id}-soft`} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Bloom, from the sphere and the brightest accents only. */}
      <AbsoluteFill
        style={{ filter: 'blur(30px)', mixBlendMode: 'screen', opacity: 0.55 }}
      >
        <AbsoluteFill style={stage}>
          <div style={plane}>
            <PlaneContent theme={theme} frame={frame} variant="bloom" idPrefix={`${theme.id}-bloom`} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Vignette. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(ellipse 76% 70% at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.62) 100%)',
          pointerEvents: 'none',
        }}
      />

      <Grain frame={frame} />
    </AbsoluteFill>
  );
};
