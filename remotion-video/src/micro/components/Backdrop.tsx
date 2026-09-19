// Volumetric background.
//
// The references all sit in a lit fluid rather than on a flat colour: a broad
// glow behind the subject, a darker surround, and a faint drifting haze. Doing
// that as CSS gradients behind the 3D layers is both cheaper than a fullscreen
// shader and easier to animate -- version 4's colour journey is just an
// interpolation of these stops.

import React from "react";
import { AbsoluteFill } from "remotion";

export interface BackdropProps {
  /** Colour at the centre of the glow. */
  glow: string;
  /** Colour at the edges of the frame. */
  surround: string;
  /** Glow centre, in per-cent of the frame. */
  center?: [number, number];
  /** Glow radius, in per-cent of the frame width. */
  radius?: number;
  /** Optional second, offset wash -- the red haze band in version 2. */
  wash?: {
    color: string;
    center: [number, number];
    radius: number;
    opacity: number;
  } | null;
  /** Extra darkening at the corners. */
  vignette?: number;
}

export const Backdrop: React.FC<BackdropProps> = ({
  glow,
  surround,
  center = [50, 50],
  radius = 70,
  wash = null,
  vignette = 0,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: surround }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${radius}% ${radius * 1.1}% at ${center[0]}% ${center[1]}%, ${glow} 0%, transparent 100%)`,
        }}
      />
      {wash ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse ${wash.radius}% ${wash.radius * 0.45}% at ${wash.center[0]}% ${wash.center[1]}%, ${wash.color} 0%, transparent 100%)`,
            opacity: wash.opacity,
          }}
        />
      ) : null}
      {vignette > 0 ? (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 78% 78% at 50% 50%, transparent 40%, rgba(0,0,0,1) 100%)",
            opacity: vignette,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
