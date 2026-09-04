import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { T } from "../layout";
import { blobPath } from "./blobPath";

export const Blob: React.FC<{
  width: number;
  height: number;
  uid: string;
}> = ({ width, height, uid }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [T.blobIn, T.blobInEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [T.blobIn, T.blobInEnd], [0.86, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.37;
  const d = blobPath(frame, cx, cy, r * 1.3, r * 1.0);

  const gradId = `blob-grad-${uid}`;
  const glowId = `blob-glow-${uid}`;
  const hazeId = `blob-haze-${uid}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", opacity }}
    >
      <defs>
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1={cx - r * 1.4}
          y1={cy - r}
          x2={cx + r * 1.4}
          y2={cy + r}
          gradientTransform={`rotate(${(frame * 0.42) % 360} ${cx} ${cy})`}
        >
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#6d5ef0" />
          <stop offset="100%" stopColor="#c026d3" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <radialGradient id={hazeId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5b8ff9" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#5b8ff9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}>
        <ellipse cx={cx} cy={cy} rx={r * 2.1} ry={r * 1.6} fill={`url(#${hazeId})`} />
        <path
          d={d}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={9}
          strokeOpacity={0.45}
          filter={`url(#${glowId})`}
        />
        <path
          d={d}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};
