import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { seededRandom } from "../particle-ring/random";
import {
  STAR_COUNT,
  STAR_MAX_BRIGHTNESS,
  STAR_MAX_SIZE_PX,
  STAR_MIN_BRIGHTNESS,
  STAR_MIN_SIZE_PX,
  STAR_SEED,
  STAR_TINTS,
  TWINKLE_PERIODS,
  TWINKLING_STAR_CHANCE,
} from "./constants";

type Star = {
  x: number; // fraction of width
  y: number; // fraction of height
  size: number; // px at 4K
  brightness: number;
  color: string;
  twinklePeriod: number | null;
  twinklePhase: number;
};

const buildStars = (): Star[] =>
  Array.from({ length: STAR_COUNT }, (_unused, index): Star => {
    const twinkles = seededRandom(index, STAR_SEED + 4) < TWINKLING_STAR_CHANCE;
    return {
      x: seededRandom(index, STAR_SEED),
      y: seededRandom(index, STAR_SEED + 1),
      size:
        STAR_MIN_SIZE_PX +
        (STAR_MAX_SIZE_PX - STAR_MIN_SIZE_PX) * seededRandom(index, STAR_SEED + 2),
      brightness:
        STAR_MIN_BRIGHTNESS +
        (STAR_MAX_BRIGHTNESS - STAR_MIN_BRIGHTNESS) *
          seededRandom(index, STAR_SEED + 3),
      color:
        STAR_TINTS[
          Math.floor(seededRandom(index, STAR_SEED + 5) * STAR_TINTS.length) %
            STAR_TINTS.length
        ],
      twinklePeriod: twinkles
        ? TWINKLE_PERIODS[
            Math.floor(seededRandom(index, STAR_SEED + 6) * TWINKLE_PERIODS.length) %
              TWINKLE_PERIODS.length
          ]
        : null,
      twinklePhase: seededRandom(index, STAR_SEED + 7) * Math.PI * 2,
    };
  });

// Fixed in screen space, behind the grid. The stars must not travel with
// the plane -- in the reference they read as a distant static field, and
// anything that parallaxed with the grid would give away the scale.
export const Starfield: React.FC<{ frame: number; pixelScale: number }> = ({
  frame,
  pixelScale,
}) => {
  const stars = useMemo(buildStars, []);

  return (
    <AbsoluteFill>
      {stars.map((star, index) => {
        const twinkle =
          star.twinklePeriod === null
            ? 1
            : 0.55 +
              0.45 *
                Math.sin((Math.PI * 2 * frame) / star.twinklePeriod + star.twinklePhase);
        const size = star.size * pixelScale;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${star.x * 100}%`,
              top: `${star.y * 100}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              backgroundColor: star.color,
              opacity: star.brightness * twinkle,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
