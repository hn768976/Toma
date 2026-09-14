import React from "react";
import { interpolate, Easing } from "remotion";
import {
  CENTER_X,
  CENTER_Y,
  DURATION_IN_FRAMES,
  GLOBE_RADIUS,
  RING_EXPAND_FRAME,
  RING_EXPAND_FROM,
  RING_RADII,
  RIPPLE_COUNT,
  RIPPLE_INTERVAL,
  RIPPLE_TRAVEL,
} from "./constants";

// A neon circle: two blurred passes for the bleed, then an unfiltered
// hairline on top. The core must stay unfiltered — blurring it too is
// what turns a neon line into a washed-out smudge.
export const NeonCircle: React.FC<{
  radius: number;
  opacity: number;
  coreWidth?: number;
  glowWidth?: number;
  glowOpacity?: number;
}> = ({ radius, opacity, coreWidth = 3, glowWidth = 9, glowOpacity = 0.5 }) => (
  <g opacity={opacity}>
    <circle
      cx={CENTER_X}
      cy={CENTER_Y}
      r={radius}
      fill="none"
      stroke="url(#neon)"
      strokeWidth={glowWidth}
      opacity={glowOpacity}
      filter="url(#glowWide)"
    />
    <circle
      cx={CENTER_X}
      cy={CENTER_Y}
      r={radius}
      fill="none"
      stroke="url(#neon)"
      strokeWidth={coreWidth * 1.5}
      opacity={0.75}
      filter="url(#glowTight)"
    />
    <circle
      cx={CENTER_X}
      cy={CENTER_Y}
      r={radius}
      fill="none"
      stroke="url(#neon)"
      strokeWidth={coreWidth}
    />
  </g>
);

// How far along their outward journey the persistent rings are. They
// start bunched in near the globe and swing out to their resting radii
// during the opening, then keep creeping for the rest of the shot — the
// camera is pulling back at the same time, and the two together are what
// sell the "falling away from the planet" move.
const useRingSpread = (frame: number) => {
  const launch = interpolate(frame, [0, RING_EXPAND_FRAME], [RING_EXPAND_FROM, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const creep = interpolate(
    frame,
    [RING_EXPAND_FRAME, DURATION_IN_FRAMES - 1],
    [1, 1.07],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return launch * creep;
};

const PersistentRings: React.FC<{ frame: number }> = ({ frame }) => {
  const spread = useRingSpread(frame);
  return (
    <>
      {RING_RADII.map((multiple, i) => {
        // A slow, out-of-phase brightness breath on each ring.
        const breathe =
          0.85 + 0.15 * Math.sin((frame / 150 + i * 0.37) * Math.PI * 2);
        return (
          <NeonCircle
            key={i}
            radius={GLOBE_RADIUS * multiple * spread}
            opacity={breathe}
            coreWidth={i === 0 ? 3.2 : 2.8}
            glowWidth={i === 0 ? 11 : 9}
          />
        );
      })}
    </>
  );
};

// A couple of extra rings racing out past the frame edge in the opening
// second, so the pull-back starts on movement rather than on a static
// pair of circles.
const Ripples: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {Array.from({ length: RIPPLE_COUNT }, (_, i) => {
      const age = frame - i * RIPPLE_INTERVAL;
      if (age < 0 || age > RIPPLE_TRAVEL) {
        return null;
      }
      const progress = age / RIPPLE_TRAVEL;
      const radius = interpolate(
        progress,
        [0, 1],
        [GLOBE_RADIUS * 2.6, GLOBE_RADIUS * 7.2],
        { easing: Easing.out(Easing.quad) },
      );
      const opacity = interpolate(progress, [0, 0.4, 1], [0.85, 0.55, 0]);
      return (
        <NeonCircle
          key={i}
          radius={radius}
          opacity={opacity}
          coreWidth={2.6}
          glowWidth={8}
          glowOpacity={0.4}
        />
      );
    })}
  </>
);

export const NeonRings: React.FC<{ frame: number }> = ({ frame }) => (
  <g>
    <Ripples frame={frame} />
    <PersistentRings frame={frame} />
  </g>
);
