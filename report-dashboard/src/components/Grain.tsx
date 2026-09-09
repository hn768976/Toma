import React from "react";

/**
 * Film grain as an overlay of greyscale fractal noise. The seed advances with
 * the frame so the grain moves rather than sitting as a static texture, and
 * `overlay` blending keeps it neutral against both a pale and a dark ground.
 */
export const Grain: React.FC<{
  opacity: number;
  frame: number;
  id: string;
}> = ({ opacity, frame, id }) => {
  if (opacity <= 0) return null;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity,
        mixBlendMode: "overlay",
      }}
    >
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves={1}
          // A short cycle keeps it deterministic per frame without ever
          // repeating visibly inside a 450-frame build.
          seed={frame % 211}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};
