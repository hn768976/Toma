import React, { useMemo } from "react";
import { SPARK_COUNT, SPREAD_X, SPREAD_Y, Z_SPAN } from "./constants";
import { depthAt, depthFade, place } from "./depth";
import type { Palette } from "./palette";
import { between, rngFor } from "./random";

type Spark = {
  x: number;
  y: number;
  z0: number;
  size: number;
  speed: number;
  phase: number;
};

const buildSparks = (): Spark[] =>
  Array.from({ length: SPARK_COUNT }, (_, i) => {
    const rand = rngFor(i, 8821);
    return {
      x: between(rand, -SPREAD_X, SPREAD_X),
      y: between(rand, -SPREAD_Y, SPREAD_Y),
      z0: rand() * Z_SPAN,
      size: between(rand, 7, 20),
      speed: between(rand, 1.6, 4.4),
      phase: rand() * Math.PI * 2,
    };
  });

/** Hot data points that blink through the field. */
export const Sparks: React.FC<{
  palette: Palette;
  camZ: number;
  seconds: number;
}> = ({ palette, camZ, seconds }) => {
  const sparks = useMemo(buildSparks, []);

  return (
    <>
      {sparks.map((s, i) => {
        const z = depthAt(s.z0, camZ);
        const fade = depthFade(z);
        if (fade <= 0.004) return null;
        // Sharp-topped blink rather than a sine, so it reads as a
        // packet firing instead of a slow throb.
        const blink = Math.pow(
          Math.max(0, Math.sin(seconds * s.speed + s.phase)),
          3,
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: s.size,
              height: s.size,
              marginLeft: -s.size / 2,
              marginTop: -s.size / 2,
              transform: place(s.x, s.y, z),
              opacity: fade * (0.2 + 0.8 * blink),
              background: palette.dotBright,
              boxShadow: `0 0 ${s.size * 2.4}px ${s.size * 0.5}px ${palette.ringGlow}`,
            }}
          />
        );
      })}
    </>
  );
};
