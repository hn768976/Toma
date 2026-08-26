import React, {useMemo} from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {
  CARD,
  arrowHead,
  cmdsToD,
  flatten,
  pointAt,
  roundedPath,
  transformCmds,
  type Pt,
  type RoutedEdge,
} from '../geometry';
import {EDGE_DRAW} from '../timeline';
import {THEMES, withAlpha, type Variant} from '../theme';

const CORNER = CARD * 0.28;
const CORE_W = 5;
const PULSE_PERIOD = 58;
const PULSES = 3;

/**
 * A right-angle neon path with rounded corners: bright core, soft outer glow,
 * an arrowhead at the end, and travelling pulses once the draw-on completes.
 */
export const NeonConnector: React.FC<{
  edge: RoutedEdge;
  variant: Variant;
  origin: Pt;
  startFrame: number;
}> = ({edge, variant, origin, startFrame}) => {
  const frame = useCurrentFrame();
  const theme = THEMES[variant];

  const {d, length, flat} = useMemo(() => {
    const planeCmds = roundedPath(edge.waypoints, CORNER);
    const screenCmds = transformCmds(planeCmds, origin);
    const f = flatten(screenCmds);
    return {d: cmdsToD(screenCmds), length: f.length, flat: f};
  }, [edge.waypoints, origin]);

  const progress = interpolate(frame, [startFrame, startFrame + EDGE_DRAW], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  if (frame < startFrame || progress <= 0) return null;

  const dashOffset = length * (1 - progress);
  const headOpacity = interpolate(progress, [0.88, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const complete = startFrame + EDGE_DRAW;
  const pulses: {p: Pt; opacity: number}[] = [];
  if (frame >= complete) {
    for (let i = 0; i < PULSES; i++) {
      const t = (((frame - complete) / PULSE_PERIOD + i / PULSES) % 1 + 1) % 1;
      pulses.push({
        p: pointAt(flat, t),
        opacity: Math.sin(Math.PI * Math.min(1, t / 0.94)) ** 0.55,
      });
    }
  }

  const arrowSize = CARD * 0.17;

  return (
    <g
      style={{
        filter: `drop-shadow(0 0 12px ${withAlpha(
          theme.connectorGlow,
          0.75,
        )}) drop-shadow(0 0 34px ${withAlpha(theme.connectorGlow, 0.45)})`,
      }}
    >
      <path
        d={d}
        fill="none"
        stroke={withAlpha(theme.connectorGlow, 0.16)}
        strokeWidth={CORE_W * 5.2}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={dashOffset}
      />
      <path
        d={d}
        fill="none"
        stroke={withAlpha(theme.connectorGlow, 0.36)}
        strokeWidth={CORE_W * 2.6}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={dashOffset}
      />
      <path
        d={d}
        fill="none"
        stroke={theme.connector}
        strokeWidth={CORE_W}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={dashOffset}
      />

      <polygon
        points={arrowHead(edge.waypoints, origin, arrowSize)}
        fill={theme.connector}
        opacity={headOpacity}
      />

      {pulses.map((pulse, i) => (
        <g key={i} opacity={pulse.opacity}>
          <circle
            cx={pulse.p.x}
            cy={pulse.p.y}
            r={CORE_W * 3.4}
            fill={withAlpha(theme.connectorGlow, 0.3)}
          />
          <circle cx={pulse.p.x} cy={pulse.p.y} r={CORE_W * 1.5} fill={theme.pulseCore} />
        </g>
      ))}
    </g>
  );
};
