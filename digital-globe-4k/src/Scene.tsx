import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {DESIGN_HEIGHT, DESIGN_WIDTH} from './config';
import type {Theme} from './theme';
import {BinaryField} from './BinaryField';
import {Globe} from './Globe';
import {ensureFont} from './load-font';

/** Globe geometry in design space. */
const GLOBE_CX = DESIGN_WIDTH * 0.5;
const GLOBE_CY = DESIGN_HEIGHT * 0.5;
const GLOBE_R = DESIGN_HEIGHT * 0.335;
const RING_R = DESIGN_HEIGHT * 0.392;

/**
 * Longitude drift in degrees per second, and the starting longitude. Both are
 * matched to the reference: it opens on the Atlantic and has turned as far as
 * Africa/Europe by the six second mark.
 */
const ROTATION_SPEED = 11;
const ROTATION_START = 40;

export const Scene: React.FC<{theme: Theme}> = ({theme}) => {
  ensureFont();

  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;

  const rotation = ROTATION_START - time * ROTATION_SPEED;

  // A very slow push-in keeps the frame alive without ever reading as a zoom.
  const camScale = 1 + time * 0.0032;
  const camY = Math.sin(time * 0.32) * 6;

  const id = theme.id;

  return (
    <AbsoluteFill style={{backgroundColor: theme.bgDeep}}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        style={{display: 'block'}}
      >
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={theme.bgDeep} />
            <stop offset="30%" stopColor={theme.bgDeep} />
            <stop offset="72%" stopColor={theme.bgInner} />
            <stop offset="100%" stopColor={theme.bgOuter} />
          </linearGradient>

          <radialGradient id={`glowBig-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={theme.glow} stopOpacity={0.85} />
            <stop offset="40%" stopColor={theme.glow} stopOpacity={0.3} />
            <stop offset="100%" stopColor={theme.glow} stopOpacity={0} />
          </radialGradient>

          <radialGradient id={`glowCore-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={theme.glowCore} stopOpacity={0.95} />
            <stop offset="30%" stopColor={theme.glowCore} stopOpacity={0.35} />
            <stop offset="100%" stopColor={theme.glowCore} stopOpacity={0} />
          </radialGradient>

          <radialGradient id={`sphereBody-${id}`} cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor={theme.sphere} stopOpacity={0.42} />
            <stop offset="72%" stopColor={theme.sphere} stopOpacity={0.2} />
            <stop offset="100%" stopColor={theme.sphere} stopOpacity={0} />
          </radialGradient>

          <radialGradient id={`vignette-${id}`} cx="50%" cy="50%" r="72%">
            <stop offset="48%" stopColor={theme.vignette} stopOpacity={0} />
            <stop offset="100%" stopColor={theme.vignette} stopOpacity={0.72} />
          </radialGradient>

          <linearGradient id={`streak-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={theme.streak} stopOpacity={0} />
            <stop offset="35%" stopColor={theme.streak} stopOpacity={0.5} />
            <stop offset="70%" stopColor={theme.glow} stopOpacity={0.45} />
            <stop offset="100%" stopColor={theme.glow} stopOpacity={0} />
          </linearGradient>

          {/* Soft-light bloom. stdDeviation is in user units, so it scales with
              the viewBox and stays identical at 1080p and 4K. */}
          <filter id={`bloomSoft-${id}`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
          <filter id={`bloomWide-${id}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="70" />
          </filter>
          <filter id={`blurField-${id}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="14" />
          </filter>

          <filter id={`grain-${id}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        {/* --- backdrop ------------------------------------------------- */}
        <rect width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill={`url(#bg-${id})`} />

        <g transform={`translate(${GLOBE_CX} ${GLOBE_CY + camY}) scale(${camScale}) translate(${-GLOBE_CX} ${-GLOBE_CY})`}>
          {/* --- horizontal light bands drifting through the data ------- */}
          <g style={{mixBlendMode: 'screen'}} opacity={0.5}>
            {[0.18, 0.46, 0.63, 0.86].map((p, i) => {
              const drift = ((time * (6 + i * 3)) % (DESIGN_HEIGHT * 1.2)) - DESIGN_HEIGHT * 0.1;
              return (
                <rect
                  key={i}
                  x={-200}
                  y={DESIGN_HEIGHT * p + drift * 0.06}
                  width={DESIGN_WIDTH + 400}
                  height={90 + i * 46}
                  fill={`url(#streak-${id})`}
                  opacity={0.32 + 0.18 * Math.sin(time * 0.5 + i)}
                  filter={`url(#bloomWide-${id})`}
                />
              );
            })}
          </g>

          {/* --- binary data field, plus its own soft halo -------------- */}
          <g style={{mixBlendMode: 'screen'}} opacity={0.42} filter={`url(#blurField-${id})`}>
            <BinaryField theme={theme} time={time} />
          </g>
          <BinaryField theme={theme} time={time} />

          {/* --- the big soft light on the right ------------------------ */}
          <g style={{mixBlendMode: 'screen'}}>
            <ellipse
              cx={DESIGN_WIDTH * 0.955}
              cy={DESIGN_HEIGHT * 0.5}
              rx={DESIGN_WIDTH * 0.28}
              ry={DESIGN_HEIGHT * 0.44}
              fill={`url(#glowBig-${id})`}
              opacity={0.9 + 0.06 * Math.sin(time * 0.6)}
            />
            <ellipse
              cx={DESIGN_WIDTH * 0.975}
              cy={DESIGN_HEIGHT * 0.5}
              rx={DESIGN_WIDTH * 0.06}
              ry={DESIGN_HEIGHT * 0.1}
              fill={`url(#glowCore-${id})`}
              opacity={0.75 + 0.08 * Math.sin(time * 0.9 + 1)}
            />
            {/* a much dimmer counter-light so the left edge is not dead */}
            <ellipse
              cx={DESIGN_WIDTH * 0.02}
              cy={DESIGN_HEIGHT * 0.28}
              rx={DESIGN_WIDTH * 0.18}
              ry={DESIGN_HEIGHT * 0.3}
              fill={`url(#glowBig-${id})`}
              opacity={0.16}
            />
          </g>

          {/* --- globe --------------------------------------------------- */}
          <g style={{mixBlendMode: 'screen'}} opacity={0.55} filter={`url(#bloomSoft-${id})`}>
            <Globe rotation={rotation} cx={GLOBE_CX} cy={GLOBE_CY} radius={GLOBE_R} theme={theme} />
          </g>
          <Globe rotation={rotation} cx={GLOBE_CX} cy={GLOBE_CY} radius={GLOBE_R} theme={theme} />

          {/* --- orbit ring, bloom pass then crisp pass ------------------ */}
          <g style={{mixBlendMode: 'screen'}}>
            <circle
              cx={GLOBE_CX}
              cy={GLOBE_CY}
              r={RING_R}
              fill="none"
              stroke={theme.ring}
              strokeWidth={16}
              opacity={0.5}
              filter={`url(#bloomSoft-${id})`}
            />
          </g>
          <circle
            cx={GLOBE_CX}
            cy={GLOBE_CY}
            r={RING_R}
            fill="none"
            stroke={theme.ring}
            strokeWidth={4.5}
            opacity={0.9}
          />
        </g>

        {/* --- grade ----------------------------------------------------- */}
        <rect width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill={`url(#vignette-${id})`} />
        <rect
          width={DESIGN_WIDTH}
          height={DESIGN_HEIGHT}
          filter={`url(#grain-${id})`}
          opacity={0.045}
          style={{mixBlendMode: 'overlay'}}
        />
      </svg>
    </AbsoluteFill>
  );
};
