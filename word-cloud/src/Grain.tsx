import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * Fine grain, ~1.5% mean lift. A 10-second black field will band across the
 * vignette and the near-word glow without it.
 *
 * The noise is an feTurbulence tile whose seed steps once per frame through a
 * fixed set of 5, so it shimmers like film grain, stays a pure function of the
 * frame, and loops (300 % 5 === 0). The component transfer pulls the mean of
 * the noise down so the blend lifts black by a couple of values rather than
 * flattening it to grey.
 */
const SEEDS = 5;
const TILE = 420;

const tile = (seed: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">` +
      `<filter id="g" x="0" y="0" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="saturate" values="0"/>` +
      `<feComponentTransfer><feFuncR type="linear" slope="1" intercept="-0.55"/>` +
      `<feFuncG type="linear" slope="1" intercept="-0.55"/>` +
      `<feFuncB type="linear" slope="1" intercept="-0.55"/></feComponentTransfer>` +
      `</filter><rect width="100%" height="100%" filter="url(#g)"/></svg>`,
  )}")`;

export const Grain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  if (opacity <= 0) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{
        backgroundImage: tile(frame % SEEDS),
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE}px ${TILE}px`,
        mixBlendMode: "screen",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
