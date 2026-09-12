import React, { useMemo } from "react";
import { SPREAD_X, SPREAD_Y, STREAK_COUNT, Z_SPAN } from "./constants";
import { defocusAt, depthAt, depthFade, place } from "./depth";
import type { Palette } from "./palette";
import { between, rngFor } from "./random";

type Streak = {
  x: number;
  y: number;
  z0: number;
  length: number;
  thickness: number;
  /** Yaw/pitch of the bar. Near +-90deg it lies along the view axis. */
  yaw: number;
  pitch: number;
  dotted: boolean;
  weight: number;
};

const buildStreaks = (): Streak[] =>
  Array.from({ length: STREAK_COUNT }, (_, i) => {
    const rand = rngFor(i, 2207);
    const side = rand() < 0.5 ? 1 : -1;
    return {
      x: between(rand, -SPREAD_X * 0.8, SPREAD_X * 0.8),
      y: between(rand, -SPREAD_Y * 0.8, SPREAD_Y * 0.8),
      z0: rand() * Z_SPAN,
      length: between(rand, 1600, 4200),
      thickness: between(rand, 2.2, 5),
      // Steeply raked so the bar runs into the distance and the lens
      // does the foreshortening, rather than being drawn as a diagonal.
      yaw: side * between(rand, 52, 84),
      pitch: between(rand, -22, 22),
      dotted: rand() < 0.5,
      weight: between(rand, 0.4, 1),
    };
  });

/**
 * Data traces running along the view axis. These are what make the
 * perspective legible: because they genuinely extend in Z, they
 * converge on the vanishing point instead of just being angled lines.
 */
export const Streaks: React.FC<{ palette: Palette; camZ: number }> = ({
  palette,
  camZ,
}) => {
  const streaks = useMemo(buildStreaks, []);

  return (
    <>
      {streaks.map((s, i) => {
        const z = depthAt(s.z0, camZ);
        const fade = depthFade(z);
        if (fade <= 0.004) return null;
        const blur = defocusAt(z);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: s.length,
              height: s.thickness,
              marginLeft: -s.length / 2,
              marginTop: -s.thickness / 2,
              transform: `${place(s.x, s.y, z)} rotateY(${s.yaw.toFixed(2)}deg) rotateX(${s.pitch.toFixed(2)}deg)`,
              transformStyle: "preserve-3d",
              opacity: fade * s.weight,
              filter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
              background: s.dotted
                ? `repeating-linear-gradient(90deg, ${palette.streak} 0 ${s.thickness * 2}px, rgba(0,0,0,0) ${s.thickness * 2}px ${s.thickness * 6}px)`
                : `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${palette.streak} 62%, ${palette.streakHot} 100%)`,
            }}
          />
        );
      })}
    </>
  );
};
