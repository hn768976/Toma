import React from "react";
import { AbsoluteFill } from "remotion";
import { useUnit } from "./units";

/**
 * Film-grain overlay that breaks up 8-bit gradient banding before H.264
 * encoding. It is a pure function of (pixel position, seed): feTurbulence with
 * a fixed seed per frame, never Math.random(). Looping looks pass
 * `frame % loopFrames` as the seed so the loop closes.
 */
export const Grain: React.FC<{
  id: string;
  seed: number;
  /** Overlay strength, 0.015–0.025. */
  amount: number;
}> = ({ id, seed, amount }) => {
  const { width, height, u } = useUnit();
  const filterId = `grain-${id}`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: amount }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        <filter
          id={filterId}
          x="0"
          y="0"
          width="100%"
          height="100%"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            // ~1 grain per 2 px at 4K, i.e. 1 px at 1080p
            baseFrequency={0.55 / u(1)}
            numOctaves={2}
            seed={seed + 1}
            stitchTiles="noStitch"
          />
          <feColorMatrix type="saturate" values="0" />
          {/* Stretch the noise to the full 0..1 range, opaque. */}
          <feComponentTransfer>
            <feFuncR type="linear" slope="3" intercept="-1" />
            <feFuncG type="linear" slope="3" intercept="-1" />
            <feFuncB type="linear" slope="3" intercept="-1" />
            <feFuncA type="linear" slope="0" intercept="1" />
          </feComponentTransfer>
        </filter>
        <rect width={width} height={height} filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
};
