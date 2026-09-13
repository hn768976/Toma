import React, { useMemo } from "react";
import { HOLOGRAM_CORE_COLOR, HOLOGRAM_MID_COLOR, HOLOGRAM_OUTER_COLOR } from "./constants";
import { cumulativeLengths, pathFromPoints, pointAtLength, type Point } from "./geometry";
import { mulberry32, rangeFrom } from "./random";

// Shared "electric neon" edge used by both the cloud and the AI chip:
// stacked blurred strokes for the bloom, a crisp white core, a crackling
// dotted layer, bright beads racing around the outline, and sparks that
// fly off the edge and fade.
type Props = {
  points: Point[];
  frame: number;
  filterPrefix: string;
  sparkSeed: number;
  beadCount?: number;
};

type Spark = { born: number; life: number; along: number; vx: number; vy: number; size: number };

const SPARK_COUNT = 70;

export const HologramOutline: React.FC<Props> = ({ points, frame, filterPrefix, sparkSeed, beadCount = 7 }) => {
  const d = useMemo(() => pathFromPoints(points, true), [points]);
  const sampled = useMemo(() => cumulativeLengths(points, true), [points]);
  const sparks = useMemo(() => {
    const rng = mulberry32(sparkSeed);
    const list: Spark[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      list.push({
        born: rng() * 60,
        life: rangeFrom(rng, 18, 40),
        along: rng() * sampled.total,
        vx: rangeFrom(rng, -1.6, 1.6),
        vy: rangeFrom(rng, -1.6, 1.6),
        size: rangeFrom(rng, 1.2, 3),
      });
    }
    return list;
  }, [sparkSeed, sampled.total]);

  const flicker = 0.92 + 0.08 * Math.sin(frame * 0.9) * Math.sin(frame * 0.37);
  const glowId = `${filterPrefix}-glowWide`;
  const midId = `${filterPrefix}-glowMid`;
  const softId = `${filterPrefix}-glowSoft`;

  return (
    <g>
      <defs>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
        <filter id={midId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={softId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* Bloom stack. */}
      <path d={d} fill="none" stroke={HOLOGRAM_OUTER_COLOR} strokeWidth={70} opacity={0.6 * flicker} filter={`url(#${glowId})`} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={HOLOGRAM_MID_COLOR} strokeWidth={20} opacity={0.85 * flicker} filter={`url(#${midId})`} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={HOLOGRAM_CORE_COLOR} strokeWidth={7} opacity={0.95} filter={`url(#${softId})`} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={HOLOGRAM_CORE_COLOR} strokeWidth={3} strokeLinejoin="round" />

      {/* Crackling dotted layers rotating in opposite directions. */}
      <path
        d={d}
        pathLength={sampled.total}
        fill="none"
        stroke="#e9fdff"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray="1.5 13"
        strokeDashoffset={-frame * 3.1}
        opacity={0.9}
      />
      <path
        d={d}
        pathLength={sampled.total}
        fill="none"
        stroke={HOLOGRAM_MID_COLOR}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray="1 21"
        strokeDashoffset={frame * 2.2 + 7}
        opacity={0.7}
      />

      {/* Beads racing along the edge with short trails. */}
      {Array.from({ length: beadCount }, (_, i) => {
        const speed = 11 + (i % 3) * 4;
        const dir = i % 2 === 0 ? 1 : -1;
        const head = (i * sampled.total) / beadCount + frame * speed * dir;
        return (
          <g key={i}>
            {Array.from({ length: 6 }, (_, k) => {
              const p = pointAtLength(sampled, head - k * 7 * dir);
              return (
                <circle key={k} cx={p.x} cy={p.y} r={5 - k * 0.6} fill="#ffffff" opacity={(1 - k / 6) * 0.9} />
              );
            })}
            {(() => {
              const p = pointAtLength(sampled, head);
              return <circle cx={p.x} cy={p.y} r={14} fill={HOLOGRAM_MID_COLOR} opacity={0.5} filter={`url(#${midId})`} />;
            })()}
          </g>
        );
      })}

      {/* Sparks flying off the edge. */}
      {sparks.map((s, i) => {
        const cycle = s.life + 30;
        const age = (((frame - s.born) % cycle) + cycle) % cycle;
        if (age > s.life) return null;
        const t = age / s.life;
        const p = pointAtLength(sampled, s.along + Math.floor((frame - s.born) / cycle) * 173);
        const x = p.x + s.vx * age;
        const y = p.y + s.vy * age - 0.02 * age * age;
        return <circle key={i} cx={x} cy={y} r={s.size * (1 - t * 0.5)} fill="#dffcff" opacity={(1 - t) * 0.95} />;
      })}
    </g>
  );
};
