import React from "react";
import { interpolate } from "remotion";
import {
  CENTER_X,
  CENTER_Y,
  DOT_SPIN_PERIOD,
  GLOBE_RADIUS,
  TWINKLE_PERIOD,
  type Palette,
} from "./constants";
import { DOTS } from "./scene-data";

// The dark disc at the centre plus the speckled band of "city lights"
// turning slowly around its rim.
export const Globe: React.FC<{ palette: Palette; frame: number }> = ({
  palette,
  frame,
}) => {
  const spin = (frame / DOT_SPIN_PERIOD) * Math.PI * 2;
  // Dots come up shortly after the ripples clear, just ahead of the icons.
  const dotsOpacity = interpolate(frame, [14, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <g>
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={GLOBE_RADIUS}
        fill="url(#globeFill)"
      />
      {/* Rim: bleed pass then hairline, same recipe as the big rings. */}
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={GLOBE_RADIUS}
        fill="none"
        stroke="url(#neon)"
        strokeWidth={9}
        opacity={0.5}
        filter="url(#glowWide)"
      />
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={GLOBE_RADIUS}
        fill="none"
        stroke="url(#neon)"
        strokeWidth={3}
        filter="url(#glowTight)"
      />

      <g opacity={dotsOpacity}>
        {DOTS.map((dot, i) => {
          const angle = dot.angle + spin;
          // Each dot breathes in and out of the rim band a little, which
          // keeps the band from reading as a rigid dotted circle.
          const radius =
            dot.radius +
            3.5 * Math.sin((frame / 73 + dot.phase) * Math.PI * 2);
          const twinkle =
            0.45 +
            0.55 *
              (0.5 +
                0.5 *
                  Math.sin(
                    (frame / TWINKLE_PERIOD + dot.phase) * Math.PI * 2,
                  ));
          const color = palette.dots[dot.colorIndex % palette.dots.length];
          return (
            <circle
              key={i}
              cx={CENTER_X + Math.cos(angle) * radius}
              cy={CENTER_Y + Math.sin(angle) * radius}
              r={dot.size}
              fill={color}
              opacity={dot.baseOpacity * twinkle}
            />
          );
        })}
      </g>
    </g>
  );
};
