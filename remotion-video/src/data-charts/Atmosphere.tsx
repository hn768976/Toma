import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BASE_HEIGHT, BASE_WIDTH, DURATION_IN_FRAMES } from "./constants";
import { seededSeries } from "./motion";
import type { Theme } from "./themes";

type Props = { theme: Theme };

const DUST_COUNT = 46;

// Everything layered over the 3D scene to sell the "footage" look: a
// drifting haze glare, floating dust motes, a light sweep and a vignette.
export const Atmosphere: React.FC<Props> = ({ theme }) => {
  const frame = useCurrentFrame();
  const px = seededSeries(901, DUST_COUNT);
  const py = seededSeries(902, DUST_COUNT);
  const ps = seededSeries(903, DUST_COUNT);
  const pp = seededSeries(904, DUST_COUNT);

  const hazeX = interpolate(frame, [0, DURATION_IN_FRAMES], [62, 50]);
  const hazeY = interpolate(frame, [0, DURATION_IN_FRAMES], [36, 46]);
  const sweep = interpolate(frame, [0, DURATION_IN_FRAMES], [-40, 140]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Haze / glare */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 34% 40% at ${hazeX}% ${hazeY}%, ${theme.haze} 0%, transparent 100%)`,
          mixBlendMode: theme.dustBlend === "screen" ? "screen" : "normal",
        }}
      />
      {/* Light sweep */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(115deg, transparent ${sweep - 18}%, ${theme.haze} ${sweep}%, transparent ${sweep + 18}%)`,
          opacity: 0.55,
          mixBlendMode: theme.dustBlend === "screen" ? "screen" : "normal",
        }}
      />
      {/* Dust motes */}
      {px.map((x, i) => {
        const speed = 0.12 + ps[i] * 0.25;
        const y = ((py[i] * BASE_HEIGHT - frame * speed) % BASE_HEIGHT + BASE_HEIGHT) % BASE_HEIGHT;
        const sway = Math.sin(frame * 0.02 + pp[i] * Math.PI * 2) * 18;
        const size = 2 + ps[i] * 5;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(frame * 0.05 + pp[i] * 10));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x * BASE_WIDTH + sway,
              top: y,
              width: size,
              height: size,
              borderRadius: size,
              background: theme.dust,
              opacity: twinkle,
              filter: `blur(${size > 5 ? 1.5 : 0.6}px)`,
              mixBlendMode: theme.dustBlend,
            }}
          />
        );
      })}
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 68% at 50% 50%, transparent 40%, ${theme.vignette} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
