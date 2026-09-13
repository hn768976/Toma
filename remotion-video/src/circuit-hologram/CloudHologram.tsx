import React, { useMemo } from "react";
import { buildCloudOutline, pathFromPoints } from "./geometry";
import { ChipBlocks } from "./ChipBlocks";
import { HologramOutline } from "./HologramOutline";

// The glowing cloud from the reference: neon outline over a dark
// interior packed with flickering circuit tiles.
export const CLOUD_WIDTH = 540;
export const CLOUD_HEIGHT = 300;

export const CloudHologram: React.FC<{ frame: number }> = ({ frame }) => {
  const points = useMemo(() => buildCloudOutline(), []);
  const d = useMemo(() => pathFromPoints(points, true), [points]);
  const inside = useMemo(() => {
    // Point-in-polygon against the sampled outline.
    return (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const pi = points[i];
        const pj = points[j];
        if (pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x) c = !c;
      }
      return c;
    };
  }, [points]);
  const bounds = useMemo(() => ({ x: 20, y: 10, w: 500, h: 265 }), []);

  return (
    <svg
      width={CLOUD_WIDTH}
      height={CLOUD_HEIGHT}
      viewBox={`-10 -20 ${CLOUD_WIDTH} ${CLOUD_HEIGHT}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <clipPath id="cloudClip">
          <path d={d} />
        </clipPath>
        <radialGradient id="cloudInner" cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor="#0b1c4a" />
          <stop offset="100%" stopColor="#040a1f" />
        </radialGradient>
      </defs>
      <path d={d} fill="url(#cloudInner)" opacity={0.92} />
      <g clipPath="url(#cloudClip)">
        <g stroke="#173f96" strokeWidth={0.8} opacity={0.5}>
          {Array.from({ length: 28 }, (_, i) => (
            <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={300} />
          ))}
          {Array.from({ length: 15 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 20} x2={560} y2={i * 20} />
          ))}
        </g>
        <ChipBlocks frame={frame} bounds={bounds} seed={77} inside={inside} />
        {/* Slow scan-line sweep across the interior. */}
        <rect
          x={-40 + ((frame * 2.4) % 640)}
          y={-20}
          width={26}
          height={320}
          fill="#7df0ff"
          opacity={0.12}
        />
      </g>
      <HologramOutline points={points} frame={frame} filterPrefix="cloud" sparkSeed={9} />
    </svg>
  );
};
