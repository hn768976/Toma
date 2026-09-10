import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, type Accent } from "../theme";
import { alpha } from "../color";
import { alarmWash, ambientPulse } from "../alert";
import { rngFor } from "../random";

/**
 * A tiled fractal-noise square. Kept small and repeated rather than run
 * across the whole 4K frame, which would cost far more than the ~2% of
 * grain it buys. Doubles as a dither over the teal gradient, where flat
 * 8-bit ramps would otherwise band in the encode.
 */
const NOISE_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  // Jump the tile to a new seeded offset each frame so the grain crawls
  // instead of sitting still like a texture stuck to the lens.
  const rand = rngFor(`grain:${frame}`);
  const x = Math.floor(rand() * 240);
  const y = Math.floor(rand() * 240);

  return (
    <AbsoluteFill
      style={{
        backgroundImage: NOISE_TILE,
        backgroundRepeat: "repeat",
        backgroundPosition: `${x}px ${y}px`,
        opacity: 0.022,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

export const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage:
        "repeating-linear-gradient(to bottom, rgba(0,0,0,0.85) 0px, rgba(0,0,0,0.85) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)",
      opacity: 0.04,
      pointerEvents: "none",
    }}
  />
);

/** Corner falloff plus the soft centre lift of a CRT. */
export const CrtGlow: React.FC = () => (
  <>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 64% 60% at 50% 46%, rgba(122,212,220,0.13) 0%, rgba(122,212,220,0) 64%)",
        pointerEvents: "none",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 80% 78% at 50% 48%, rgba(0,0,0,0) 44%, rgba(3,22,28,0.26) 80%, rgba(2,16,21,0.5) 100%)",
        pointerEvents: "none",
      }}
    />
  </>
);

/**
 * The alarm pulse. A wide soft band crossing the frame — twice and hard
 * for the breach, once and gently for the granted cut — plus a low
 * ambient tint that keeps the accent alive through the hold.
 */
export const AlarmWash: React.FC<{ accent: Accent }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const wash = alarmWash(frame, accent);
  const ambient = ambientPulse(frame, accent);

  return (
    <>
      <AbsoluteFill
        style={{
          background: accent.color,
          opacity: ambient * 0.055,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      {wash ? (
        <AbsoluteFill
          style={{
            background: `linear-gradient(100deg, ${alpha(accent.color, 0)} ${
              wash.position * 100 - 26
            }%, ${alpha(accent.color, 0.5)} ${wash.position * 100}%, ${alpha(
              accent.color,
              0,
            )} ${wash.position * 100 + 26}%)`,
            opacity: wash.strength * 0.5,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </>
  );
};

/** The base field: deep teal, darker toward the corners. */
export const Field: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 90% 86% at 48% 44%, #11495a 0%, ${COLORS.bg} 54%, ${COLORS.bgDeep} 100%)`,
    }}
  />
);
