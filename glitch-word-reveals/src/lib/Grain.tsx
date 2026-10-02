import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// Film grain, drawn LAST (after the glow) to dither gradients so H.264
// doesn't band them. It's SVG feTurbulence whose seed is the frame number:
// a fixed function of pixel position and frame. No Math.random().
//
// Grey noise, contrast-stretched around 0.5, composited at `amount` alpha:
// peak deviation is about ±amount/2 of full scale (amount 0.036 -> ±1.8%).
export const Grain: React.FC<{ amount?: number; id: string }> = ({
  amount = 0.036,
  id,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // ~1 device pixel per grain at the 1080p preview, ~2px at 4K.
  const freq = (0.62 * 2160) / height;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, opacity: amount }}
    >
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency={freq}
          numOctaves={1}
          seed={(frame * 7919) % 100003}
          stitchTiles="noStitch"
        />
        {/* R channel -> grey, stretched x3 around 0.5, fully opaque */}
        <feColorMatrix
          type="matrix"
          values="3 0 0 0 -1  3 0 0 0 -1  3 0 0 0 -1  0 0 0 0 1"
        />
      </filter>
      <rect width={width} height={height} filter={`url(#${id})`} />
    </svg>
  );
};
