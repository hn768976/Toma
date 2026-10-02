import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Direction, PRESETS } from "../constants";
import { ArrowSpec } from "./scene-data";

const moveEase = Easing.bezier(0.45, 0, 0.35, 1);

// One striped LED-bar arrow, drawn pointing UP in local coordinates.
const ArrowShape: React.FC<{
  w: number;
  len: number;
  u: number;
  color: string;
  uid: string;
}> = ({ w, len, u, color, uid }) => {
  const head = w * 1.35;
  const sw = w * 0.4;
  const c = w / 2;
  const poly = [
    [c, 0],
    [w, head],
    [c + sw / 2, head],
    [c + sw / 2, len],
    [c - sw / 2, len],
    [c - sw / 2, head],
    [0, head],
  ]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const stripe = 15 * u;
  return (
    <>
      <defs>
        <pattern id={`st-${uid}`} patternUnits="userSpaceOnUse" width={w} height={stripe}>
          <rect width={w} height={stripe * 0.62} fill={color} />
        </pattern>
        <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity={1} />
          <stop offset="35%" stopColor="#fff" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id={`m-${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={len}>
          <polygon points={poly} fill={`url(#fade-${uid})`} />
        </mask>
        <filter id={`gl-${uid}`} x="-200%" y="-20%" width="500%" height="140%">
          <feGaussianBlur stdDeviation={22 * u} />
        </filter>
      </defs>
      <polygon points={poly} fill={color} opacity={0.9} mask={`url(#m-${uid})`} filter={`url(#gl-${uid})`} />
      <rect width={w} height={len} fill={`url(#st-${uid})`} mask={`url(#m-${uid})`} />
      <polygon points={`${c},${4 * u} ${w - 10 * u},${head - 4 * u} ${10 * u},${head - 4 * u}`} fill="#FFFFFF" opacity={0.18} />
    </>
  );
};

export const Arrows: React.FC<{ arrows: ArrowSpec[]; dir: Direction; uid: string }> = ({
  arrows,
  dir,
  uid,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = H / 2160;
  const color = PRESETS[dir].line;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {arrows.map((a, i) => {
        const w = 175 * u * a.size;
        const len = 1300 * u * a.size;
        const pad = 90 * u;
        // y of the arrow TIP; travels fully across the frame.
        const tipAt = (fr: number) => {
          const t = interpolate(fr, [a.start, a.start + a.duration], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: moveEase,
          });
          return dir === "Up"
            ? interpolate(t, [0, 1], [H + 40 * u, -len - 40 * u])
            : interpolate(t, [0, 1], [-40 * u, H + len + 40 * u]);
        };
        if (frame < a.start - 1 || frame > a.start + a.duration + 1) return null;
        // Motion trail: ghost copies at where the arrow was a moment ago.
        const ghosts = [3, 2, 1, 0].map((k) => ({ y: tipAt(frame - k * 1.5), o: k === 0 ? 1 : 0.32 / k }));
        return ghosts.map((g, k) => (
          <svg
            key={`${i}-${k}`}
            width={w + pad * 2}
            height={len + pad * 2}
            viewBox={`${-pad} ${-pad} ${w + pad * 2} ${len + pad * 2}`}
            style={{
              position: "absolute",
              left: a.x * W - w / 2 - pad,
              top: (dir === "Up" ? g.y : g.y - len) - pad,
              opacity: g.o,
              transform: dir === "Down" ? "scaleY(-1)" : undefined,
            }}
          >
            <ArrowShape w={w} len={len} u={u} color={color} uid={`${uid}-${i}-${k}`} />
          </svg>
        ));
      })}
    </AbsoluteFill>
  );
};
