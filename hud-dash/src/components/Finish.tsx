import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH } from "../constants";
import { wrap } from "../lib/anim";
import { alpha } from "../lib/color";
import type { Variant } from "../variants";
import { Layer } from "./Layer";

const TILE = 192;
const TILES = 8;
const SCANLINE_STEP = 5;
const SCANLINE_ALPHA = 0.03;
const VIGNETTE = 0.18;
const GRAIN_ALPHA = 0.04;

/**
 * Vignette + scanlines are static and baked once. Grain re-tiles every frame,
 * seeded on frame % LOOP so the grain pattern loops with everything else.
 */
export const Finish: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const p = variant.palette;

  const baked = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = WIDTH;
    c.height = HEIGHT;
    const ctx = c.getContext("2d");
    if (!ctx) {
      return c;
    }

    // vignette
    const g = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.28,
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH * 0.62,
    );
    g.addColorStop(0, alpha(p.void, 0));
    g.addColorStop(0.62, alpha(p.void, VIGNETTE));
    g.addColorStop(1, alpha(p.void, VIGNETTE * 2.4));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // scanlines
    ctx.fillStyle = alpha(p.void, SCANLINE_ALPHA);
    for (let y = 0; y < HEIGHT; y += SCANLINE_STEP) {
      ctx.fillRect(0, y, WIDTH, 1);
    }
    return c;
  }, [p]);

  const grain = useMemo(() => {
    return Array.from({ length: TILES }, (_, t) => {
      const c = document.createElement("canvas");
      c.width = TILE;
      c.height = TILE;
      const ctx = c.getContext("2d");
      if (!ctx) {
        return c;
      }
      const img = ctx.createImageData(TILE, TILE);
      for (let i = 0; i < TILE * TILE; i++) {
        const v = random(`grain-${t}-${i}`);
        const light = v > 0.5;
        const a = Math.round(Math.abs(v - 0.5) * 2 * 90);
        const o = i * 4;
        img.data[o] = light ? 255 : 0;
        img.data[o + 1] = light ? 255 : 0;
        img.data[o + 2] = light ? 255 : 0;
        img.data[o + 3] = a;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    });
  }, []);

  const f = wrap(frame);
  const tile = grain[Math.floor(random(`grain-pick-${f}`) * TILES) % TILES];
  const ox = Math.floor(random(`grain-x-${f}`) * TILE);
  const oy = Math.floor(random(`grain-y-${f}`) * TILE);

  return (
    <Layer
      x={0}
      y={0}
      w={WIDTH}
      h={HEIGHT}
      draw={(ctx) => {
        ctx.drawImage(baked, 0, 0);
        const pattern = ctx.createPattern(tile, "repeat");
        if (pattern) {
          ctx.save();
          ctx.globalAlpha = GRAIN_ALPHA / 0.35;
          ctx.translate(-ox, -oy);
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, WIDTH + TILE, HEIGHT + TILE);
          ctx.restore();
        }
      }}
    />
  );
};
