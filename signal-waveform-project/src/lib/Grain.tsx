import React from "react";
import { DESIGN_H, DESIGN_W } from "./constants";
import { qaOff } from "./qa";

/**
 * Film grain to break up banding in dark gradients. Pure function of
 * (pixel position, seed): feTurbulence with an integer seed taken from the
 * frame number. Looping looks pass frame % 600 so the grain loops too.
 * Rendered last, i.e. after every glow.
 */
export const Grain: React.FC<{ seed: number; amount?: number }> = ({ seed, amount = 0.04 }) => {
  if (qaOff("grain")) return null;
  const id = `grain-${seed}`;
  return (
    <>
      <filter id={id} x="0" y="0" width={DESIGN_W} height={DESIGN_H} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="noStitch" result="n" />
        <feColorMatrix in="n" type="saturate" values="0" result="g" />
        {/* stretch the narrow fractal-noise range to roughly 0..1 */}
        <feComponentTransfer in="g">
          <feFuncR type="linear" slope="3.2" intercept="-1.1" />
          <feFuncG type="linear" slope="3.2" intercept="-1.1" />
          <feFuncB type="linear" slope="3.2" intercept="-1.1" />
          <feFuncA type="linear" slope="0" intercept="1" />
        </feComponentTransfer>
      </filter>
      {/* amount 0.04 of a 0..1 noise = +/-2 % around its mean */}
      <rect x={0} y={0} width={DESIGN_W} height={DESIGN_H} filter={`url(#${id})`} opacity={amount} />
    </>
  );
};
