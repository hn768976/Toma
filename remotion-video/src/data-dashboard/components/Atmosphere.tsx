import React from "react";
import { AbsoluteFill } from "remotion";

export type GlowSpotProps = {
  // Position as a percentage of the frame.
  x: string;
  y: string;
  size: string;
  color: string;
  opacity?: number;
};

// Broad screen-space light. Kept outside the 3D transform so it behaves
// like glow in the room rather than a decal on the dashboard plane.
export const GlowSpot: React.FC<GlowSpotProps> = ({
  x,
  y,
  size,
  color,
  opacity = 1,
}) => (
  <AbsoluteFill
    style={{
      opacity,
      background: `radial-gradient(ellipse ${size} ${size} at ${x} ${y}, ${color} 0%, rgba(0,0,0,0) 72%)`,
    }}
  />
);

export type VignetteProps = {
  color?: string;
  strength?: number;
};

export const Vignette: React.FC<VignetteProps> = ({
  color = "rgba(1, 4, 12, 0.92)",
  strength = 0.78,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 78% 72% at 50% 48%, rgba(0,0,0,0) 38%, ${color} 100%)`,
      opacity: strength,
    }}
  />
);

// Very light chroma lift in the highlights, so the renders don't read as
// flat CGI blue. Screen-blended over the finished frame.
export const Grade: React.FC<{ color?: string; opacity?: number }> = ({
  color = "rgba(60, 130, 210, 0.35)",
  opacity = 0.35,
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(160deg, ${color} 0%, rgba(0,0,0,0) 55%)`,
      mixBlendMode: "screen",
      opacity,
    }}
  />
);
