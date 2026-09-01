import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ambientDrift } from "./ambient";
import { SNOW_SHAPE_VARIANTS, scaleFor } from "./config";
import { Snowflake } from "./Snowflake";
import {
  buildFlakeShape,
  buildFlakeSprite,
  flakeTransform,
  generateFlakes,
  type FlakeSprite,
} from "./snow";
import type { Theme } from "./theme";
import { useLoopFrame } from "./useLoopFrame";

type Props = {
  width: number;
  height: number;
  theme: Theme;
};

/**
 * The foreground snowfall. Flakes snap to a size bracket so a shape is
 * stroked into an offscreen canvas exactly once per shape-and-bracket
 * pair; the 55 flakes then share that much smaller set of sprites.
 */
export const SnowLayer: React.FC<Props> = ({ width, height, theme }) => {
  const frame = useLoopFrame();
  const scale = scaleFor(width);

  const flakes = useMemo(
    () => generateFlakes(width, height, scale),
    [width, height, scale],
  );

  const shapes = useMemo(
    () =>
      Array.from({ length: SNOW_SHAPE_VARIANTS }, (_, variant) =>
        buildFlakeShape(variant),
      ),
    [],
  );

  const sprites = useMemo(() => {
    const cache = new Map<string, FlakeSprite | null>();
    for (const flake of flakes) {
      if (cache.has(flake.spriteKey)) continue;
      cache.set(
        flake.spriteKey,
        buildFlakeSprite(
          shapes[flake.shapeVariant],
          flake.bracketSize,
          flake.bracketBlur,
          theme,
        ),
      );
    }
    return cache;
  }, [flakes, shapes, theme]);

  const drift = ambientDrift(frame, scale);

  return (
    <AbsoluteFill>
      {flakes.map((flake) => {
        const sprite = sprites.get(flake.spriteKey);
        if (!sprite) return null;
        const transform = flakeTransform(flake, frame, width);
        return (
          <Snowflake
            key={flake.id}
            sprite={sprite}
            x={transform.x + drift.x}
            y={transform.y + drift.y}
            rotation={transform.rotation}
            opacity={flake.opacity}
          />
        );
      })}
    </AbsoluteFill>
  );
};
