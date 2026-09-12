import React, { useMemo } from "react";
import { interpolate } from "remotion";
import {
  PRICE_TAG_COUNT,
  SPREAD_X,
  SPREAD_Y,
  TICKER_VALUES,
  Z_SPAN,
} from "./constants";
import { Z_NEAR } from "./constants";
import { defocusAt, depthAt, depthFade, place } from "./depth";
import { TICKER_FONT } from "./fonts";
import type { Palette } from "./palette";
import { between, pick, rngFor } from "./random";

type PriceTag = {
  x: number;
  y: number;
  z0: number;
  fontSize: number;
  value: string;
  /** Filled highlight chip vs. plain type. */
  chip: boolean;
  /** Frames between value swaps; 0 = never changes. */
  tickEvery: number;
  weight: number;
  seed: number;
};

const buildTags = (): PriceTag[] =>
  Array.from({ length: PRICE_TAG_COUNT }, (_, i) => {
    const rand = rngFor(i, 913);
    return {
      x: between(rand, -SPREAD_X, SPREAD_X),
      y: between(rand, -SPREAD_Y, SPREAD_Y),
      z0: rand() * Z_SPAN,
      fontSize: between(rand, 54, 110),
      value: pick(rand, TICKER_VALUES),
      chip: rand() < 0.26,
      tickEvery: rand() < 0.45 ? Math.round(between(rand, 14, 46)) : 0,
      weight: between(rand, 0.45, 1),
      seed: Math.floor(rand() * 100000),
    };
  });

/**
 * Quoted rates scattered through the field. A subset re-quotes on its
 * own cadence — the value is picked from the frame index so it stays a
 * pure function of time and never flickers between render workers.
 */
export const PriceTags: React.FC<{
  palette: Palette;
  camZ: number;
  frame: number;
}> = ({ palette, camZ, frame }) => {
  const tags = useMemo(buildTags, []);

  return (
    <>
      {tags.map((t, i) => {
        const z = depthAt(t.z0, camZ);
        // Tags clear the lens earlier than the rest of the field: a
        // quote is type, and type that drifts within arm's reach stops
        // being texture and becomes a caption blocking the shot.
        const nearFade = interpolate(
          z,
          [Z_NEAR - 2500, Z_NEAR - 1150],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const fade = depthFade(z) * nearFade;
        if (fade <= 0.004) return null;
        const blur = defocusAt(z);
        const value =
          t.tickEvery === 0
            ? t.value
            : TICKER_VALUES[
                (t.seed + Math.floor(frame / t.tickEvery) * 7) %
                  TICKER_VALUES.length
              ];

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `${place(t.x, t.y, z)} translate(-50%, -50%)`,
              opacity: fade * t.weight,
              filter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
              fontFamily: `"${TICKER_FONT}", monospace`,
              fontSize: t.fontSize,
              lineHeight: 1,
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
              padding: t.chip ? `${t.fontSize * 0.14}px ${t.fontSize * 0.2}px` : 0,
              background: t.chip ? palette.chipFill : undefined,
              color: t.chip ? palette.chipText : palette.ticker,
              textShadow: t.chip ? undefined : `0 0 ${t.fontSize * 0.28}px ${palette.ringGlow}`,
            }}
          >
            {value}
          </div>
        );
      })}
    </>
  );
};
