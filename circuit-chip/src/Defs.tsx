import React from "react";
import { CX, CY, DH, DW, RING_R } from "./network";
import type { Theme } from "./theme";

/**
 * Gradients, patterns and filters. Ids are namespaced per composition so two
 * compositions can coexist in the Studio without colliding.
 */
export const Defs: React.FC<{ theme: Theme; id: string; grainSeed: number }> = ({
  theme,
  id,
  grainSeed,
}) => (
  <defs>
    <radialGradient id={`${id}-bg`} cx="50%" cy="50%" r="72%">
      <stop offset="0%" stopColor={theme.bgInner} />
      <stop offset="42%" stopColor={theme.bgMid} />
      <stop offset="100%" stopColor={theme.bgOuter} />
    </radialGradient>

    <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor={theme.coreGlow} stopOpacity={0.5} />
      <stop offset="38%" stopColor={theme.coreGlow} stopOpacity={0.18} />
      <stop offset="100%" stopColor={theme.coreGlow} stopOpacity={0} />
    </radialGradient>

    <radialGradient id={`${id}-vig`} cx="50%" cy="50%" r="76%">
      <stop offset="0%" stopColor="#000" stopOpacity={0} />
      <stop offset="62%" stopColor="#000" stopOpacity={0.08} />
      <stop offset="100%" stopColor="#000" stopOpacity={0.62} />
    </radialGradient>

    {/* Keeps the ring interior dark and empty — that space is where a buyer
        drops a logo. */}
    <radialGradient id={`${id}-hole`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor={theme.bgOuter} stopOpacity={0.88} />
      <stop offset="70%" stopColor={theme.bgOuter} stopOpacity={0.72} />
      <stop offset="100%" stopColor={theme.bgOuter} stopOpacity={0} />
    </radialGradient>

    <pattern id={`${id}-scan`} width={DW} height={8} patternUnits="userSpaceOnUse">
      <rect x={0} y={0} width={DW} height={2.4} fill="#ffffff" />
    </pattern>

    <filter id={`${id}-bloom`} x="-12%" y="-12%" width="124%" height="124%">
      <feGaussianBlur stdDeviation={14} />
    </filter>
    <filter id={`${id}-bloom-wide`} x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation={34} />
    </filter>

    {/* Fine grain. Without it the blue gradient bands badly in H.264. */}
    <filter id={`${id}-grain`} x="0%" y="0%" width="100%" height="100%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.72"
        numOctaves={1}
        seed={grainSeed}
        stitchTiles="stitch"
        result="t"
      />
      <feColorMatrix
        in="t"
        type="matrix"
        values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"
      />
    </filter>

    <clipPath id={`${id}-frame`}>
      <rect x={0} y={0} width={DW} height={DH} />
    </clipPath>

    <mask id={`${id}-ringmask`}>
      <rect x={0} y={0} width={DW} height={DH} fill="#fff" />
      <circle cx={CX} cy={CY} r={RING_R * 0.93} fill="#000" />
    </mask>
  </defs>
);
