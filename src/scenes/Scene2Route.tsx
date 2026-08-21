import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONT_STACK, TYPE} from '../lib/theme';
import {fadeIn, fadeInOut, ms} from '../lib/motion';
import {MAP_VIEWBOX, WorldMap} from '../components/WorldMap';
import {ROUTERS, router} from '../components/routers';

/**
 * SCENE 2 -- THE ROUTE (0:16 - 0:38)
 *
 * Build note from the spec: hop coordinates are precomputed as an array per
 * packet and driven by a small loop, rather than hand-written keyframes. The
 * trails are the same coordinate arrays, so a trail can never disagree with
 * the packet drawing it.
 */

// Local frame cues.
const F_HOP_START = 120; // 0:20 packets enter left and start hopping
const F_QUESTION = 360; // 0:28 '?' beside packet 3
const F_DIM = 540; // 0:34 map drops to 40%

const HOP = ms(300); // 300ms per hop
const LONG_HOP = ms(400); // ocean-crossing hops get the full slide duration
const LONG_HOP_DISTANCE = 120; // in map units

const MAP_PX_W = 1920;
const MAP_PX_H = Math.round(
  (MAP_PX_W * MAP_VIEWBOX.height) / MAP_VIEWBOX.width,
);

const PACKET_SIZE = 13; // map units (~26px on the 1920 canvas)
const DOT_R = 3.5;

type Waypoint = {t: number; x: number; y: number};

const at = (t: number, id: string): Waypoint => {
  const r = router(id);
  return {t, x: r.x, y: r.y};
};

/**
 * Three routes to the same destination. Packet 1 goes through Virginia,
 * packet 2 takes the southern cable route, packet 3 detours north to Iceland
 * for reasons no one has ever fully explained.
 */
const ROUTES: Waypoint[][] = [
  [
    {t: F_HOP_START, x: -40, y: 112},
    at(170, 'seattle'),
    at(225, 'chicago'),
    at(280, 'virginia'),
    at(350, 'london'),
    at(410, 'frankfurt'),
    {t: 480, x: 786, y: 226},
  ],
  [
    {t: F_HOP_START, x: -40, y: 150},
    at(175, 'losAngeles'),
    at(235, 'miami'),
    at(300, 'saoPaulo'),
    at(370, 'lagos'),
    {t: 482, x: 770, y: 252},
  ],
  [
    {t: F_HOP_START, x: -40, y: 96},
    at(180, 'seattle'),
    at(240, 'chicago'),
    at(300, 'iceland'), // <- sync-critical: the word "Iceland" lands here
    at(380, 'london'),
    at(430, 'marseille'),
    {t: 485, x: 802, y: 252},
  ],
];

const hopDuration = (a: Waypoint, b: Waypoint) =>
  Math.hypot(b.x - a.x, b.y - a.y) > LONG_HOP_DISTANCE ? LONG_HOP : HOP;

/** 2. slide -- position along the route at a given frame. */
const positionAt = (route: Waypoint[], frame: number) => {
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1];
    const to = route[i];
    const start = to.t - hopDuration(from, to);
    if (frame < start) {
      return from;
    }
    if (frame <= to.t) {
      const p = interpolate(frame, [start, to.t], [0, 1], {
        easing: Easing.inOut(Easing.ease),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return {
        x: from.x + (to.x - from.x) * p,
        y: from.y + (to.y - from.y) * p,
      };
    }
  }
  return route[route.length - 1];
};

/** The trail is the visited prefix of the same array, plus where we are now. */
const trailPoints = (route: Waypoint[], frame: number) => {
  const current = positionAt(route, frame);
  const visited = route.filter((w) => w.t <= frame);
  return [...visited, current].map((p) => `${p.x},${p.y}`).join(' ');
};

export const Scene2Route: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = fadeIn(frame, 0);
  const mapOpacity = 1 - 0.6 * fadeIn(frame, F_DIM);

  const questionOpacity = fadeInOut(frame, F_QUESTION, F_QUESTION + 30);

  const packet3 = positionAt(ROUTES[2], frame);

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, opacity: sceneOpacity}}>
      <svg
        width={MAP_PX_W}
        height={MAP_PX_H}
        viewBox={`${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        style={{position: 'absolute', left: 0, top: (1080 - MAP_PX_H) / 2}}
      >
        <g opacity={mapOpacity}>
          <WorldMap />
          {ROUTERS.map((r) => (
            <circle key={r.id} cx={r.x} cy={r.y} r={DOT_R} fill={COLORS.ink} />
          ))}
        </g>

        <g>
          {ROUTES.map((route, i) => (
            <polyline
              key={`trail-${i}`}
              points={trailPoints(route, frame)}
              fill="none"
              stroke={COLORS.ink}
              strokeWidth={1.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {ROUTES.map((route, i) => {
            const p = positionAt(route, frame);
            return (
              <rect
                key={`packet-${i}`}
                x={p.x - PACKET_SIZE / 2}
                y={p.y - PACKET_SIZE / 2}
                width={PACKET_SIZE}
                height={PACKET_SIZE}
                fill={COLORS.accent}
              />
            );
          })}

          <text
            x={packet3.x + 14}
            y={packet3.y - 8}
            fill={COLORS.ink}
            opacity={questionOpacity}
            style={{
              fontFamily: FONT_STACK,
              fontWeight: 600,
              fontSize: 22,
            }}
          >
            ?
          </text>
        </g>
      </svg>

      <div style={{...TYPE, position: 'absolute', left: 80, bottom: 56, fontSize: 30}}>
        Routers
      </div>
    </AbsoluteFill>
  );
};
