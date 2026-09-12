import React from "react";

export type NeonGlowProps = { id: string };

/**
 * Tube-neon bloom, as an SVG filter so it lives in the board's own design
 * units: three progressively wider blurs of the source stacked back under it.
 *
 * Doing this inside the SVG rather than with a CSS drop-shadow matters twice
 * over: the halo keeps each element's own colour and opacity, so the unlit dots
 * stay dim instead of picking up a bright ring, and the bloom is magnified by
 * the camera along with the artwork, so the near side of the board glows wider
 * than the far side.
 */
export const NeonGlow: React.FC<NeonGlowProps> = ({ id }) => (
  <filter
    id={id}
    x="-25%"
    y="-25%"
    width="150%"
    height="150%"
    colorInterpolationFilters="sRGB"
  >
    <feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="near" />
    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="mid" />
    <feGaussianBlur in="SourceGraphic" stdDeviation="8.5" result="far" />
    <feMerge>
      <feMergeNode in="far" />
      <feMergeNode in="far" />
      <feMergeNode in="mid" />
      <feMergeNode in="mid" />
      <feMergeNode in="near" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
