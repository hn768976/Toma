import React from "react";
import { GRADIENT_SPIN_PERIOD, type Palette } from "./constants";

// Shared paint + filter definitions.
//
// The neon gradient is a single linearGradient whose transform rotates
// once per GRADIENT_SPIN_PERIOD; every ring and the globe rim reference
// it, which is what keeps their colours locked to each other the way the
// reference's do as the sweep travels round.
export const Defs: React.FC<{ palette: Palette; frame: number }> = ({
  palette,
  frame,
}) => {
  // -34deg start puts gold across the top and azure along the bottom
  // on frame 0, which is where the reference opens.
  const sweep = -34 + (frame / GRADIENT_SPIN_PERIOD) * 360;
  const [warm, mid, cool] = palette.neon;

  return (
    <defs>
      <linearGradient
        id="neon"
        gradientUnits="objectBoundingBox"
        x1="1"
        y1="0"
        x2="0"
        y2="1"
        gradientTransform={`rotate(${sweep} 0.5 0.5)`}
      >
        <stop offset="0" stopColor={warm} />
        <stop offset="0.5" stopColor={mid} />
        <stop offset="1" stopColor={cool} />
      </linearGradient>

      <radialGradient id="globeFill" cx="0.42" cy="0.34" r="0.78">
        <stop offset="0" stopColor={palette.globeFillInner} />
        <stop offset="1" stopColor={palette.globeFillOuter} />
      </radialGradient>

      <radialGradient id="bloomWarm" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={palette.bloomWarm} />
        <stop offset="1" stopColor={palette.bloomWarm} stopOpacity="0" />
      </radialGradient>

      <radialGradient id="bloomCool" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={palette.bloomCool} />
        <stop offset="1" stopColor={palette.bloomCool} stopOpacity="0" />
      </radialGradient>

      <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
        <stop offset="0.35" stopColor={palette.vignette} stopOpacity="0" />
        <stop offset="1" stopColor={palette.vignette} />
      </radialGradient>

      {/* Two glow strengths: a tight bloom for the sharp rim, a wide
          diffuse one for the big rings. stdDeviation is in user units,
          so both scale with the viewBox and look identical at 4K. */}
      <filter id="glowTight" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id="glowWide" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="11" />
      </filter>

      {/* Bokeh blobs are out-of-focus, not glowing. One soft-edged
          gradient per palette colour is far cheaper than putting a blur
          filter on each of the 78 circles. */}
      {palette.bokeh.map((color, i) => (
        <radialGradient key={i} id={`bokeh-${i}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="0.5" stopColor={color} stopOpacity="0.72" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      ))}
    </defs>
  );
};
