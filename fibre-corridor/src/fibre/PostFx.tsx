import React, { useLayoutEffect, useMemo } from "react";
import { random } from "remotion";
import {
  bloomPass,
  createBloomBuffers,
  createGrainTiles,
  grainPass,
  parseHex,
  vignettePass,
} from "../lib";
import { HEIGHT, LOOP, WIDTH } from "./constants";
import type { Scene } from "./scene";

const GRAIN_TILE = 512;
/** LOOP is divisible by this, so the grain sequence closes with the loop. */
const GRAIN_TILES = 15;
const GRAIN_ALPHA = 0.04;
const VIGNETTE = 0.22;

/**
 * The finish: generous bloom on the cores, packets and horizon glow, a 22%
 * vignette and fine grain seeded on frame % 375 so it closes with the loop.
 */
export const PostFx: React.FC<{ scene: Scene }> = ({ scene }) => {
  const bloom = useMemo(() => createBloomBuffers(WIDTH, HEIGHT), []);
  const grain = useMemo(
    () =>
      createGrainTiles(GRAIN_TILES, GRAIN_TILE, (tile, i) =>
        random(`${scene.variant.name}-grain-${tile}-${i}`),
      ),
    [scene.variant.name],
  );

  useLayoutEffect(() => {
    const { main: ctx, variant, frame } = scene;

    bloomPass(ctx, bloom, WIDTH, HEIGHT, {
      tightAlpha: 0.42,
      tightBlur: 5,
      wideAlpha: 0.34,
      wideBlur: 4,
    });

    vignettePass(ctx, WIDTH, HEIGHT, parseHex(variant.palette.bgDeep), VIGNETTE);

    const f = ((frame % LOOP) + LOOP) % LOOP;
    const tile = grain[f % grain.length];
    if (tile) {
      grainPass(
        ctx,
        tile,
        WIDTH,
        HEIGHT,
        GRAIN_ALPHA,
        Math.floor(random(`${variant.name}-gx-${f}`) * GRAIN_TILE),
        Math.floor(random(`${variant.name}-gy-${f}`) * GRAIN_TILE),
      );
    }
  });

  return null;
};
