import React, { useMemo } from "react";
import { DURATION_IN_FRAMES, HEIGHT, WIDTH } from "../layout";
import type { FrameState } from "../lib/frame";
import { resetCtx, withAlpha } from "../lib/canvas";
import { rnd } from "../lib/rand";

/** Scanline pitch, in 4K pixels. */
const SCANLINE_PITCH = 5;
/** Grain fields per loop. 600 % GRAIN_TILES === 0 keeps the loop closed. */
const GRAIN_TILES = 20;
const GRAIN_W = 800;
const GRAIN_H = 450;
const GRAIN_ALPHA = 0.04;
/** Average darkening at the frame edge. */
const VIGNETTE = 0.18;

/**
 * Grain fields are built from a small integer generator whose seed comes from
 * Remotion's random(). Calling random() per pixel would mean seven million
 * string hashes at start-up; this stays byte-for-byte reproducible while
 * costing nothing, which is the property that actually matters.
 */
const buildGrain = (): HTMLCanvasElement[] =>
  Array.from({ length: GRAIN_TILES }, (_, t) => {
    const c = document.createElement("canvas");
    c.width = GRAIN_W;
    c.height = GRAIN_H;
    const g = c.getContext("2d") as CanvasRenderingContext2D;
    const img = g.createImageData(GRAIN_W, GRAIN_H);
    let s = Math.floor(rnd(`grain-seed-${t}`) * 0x7fffffff) | 0;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = (s >> 16) & 0xff;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = v > 200 ? v : 0;
    }
    g.putImageData(img, 0, 0);
    return c;
  });

/** Bloom, vignette, scanlines and grain — the last thing to touch the frame. */
export const PostFx: React.FC<{ state: FrameState }> = ({ state }) => {
  const { ctx, cfg, frame } = state;
  const grain = useMemo(buildGrain, []);

  resetCtx(ctx);

  // Fixed 5px scanlines, drifting one pitch every 200 frames so the pattern
  // lands back on itself at frame 600.
  const drift = (frame * 3 * SCANLINE_PITCH) / DURATION_IN_FRAMES;
  ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
  for (let y = -SCANLINE_PITCH; y < HEIGHT; y += SCANLINE_PITCH) {
    ctx.fillRect(0, Math.round(y + (drift % SCANLINE_PITCH)), WIDTH, 2);
  }

  // A single soft band sweeping slowly down the frame, once per loop.
  const bandY = ((frame / DURATION_IN_FRAMES) * (HEIGHT + 900)) - 450;
  const band = ctx.createLinearGradient(0, bandY - 450, 0, bandY + 450);
  band.addColorStop(0, withAlpha(cfg.palette.trace, 0));
  band.addColorStop(0.5, withAlpha(cfg.palette.trace, 0.02));
  band.addColorStop(1, withAlpha(cfg.palette.trace, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - 450, WIDTH, 900);
  ctx.restore();

  // Grain: one of twenty seeded fields, chosen by frame % 20.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.drawImage(grain[frame % GRAIN_TILES], 0, 0, WIDTH, HEIGHT);
  ctx.restore();

  // Vignette.
  const vig = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT * 0.28,
    WIDTH / 2,
    HEIGHT / 2,
    WIDTH * 0.72,
  );
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(0.62, `rgba(0, 0, 0, ${VIGNETTE * 0.35})`);
  vig.addColorStop(1, `rgba(0, 0, 0, ${VIGNETTE * 3.1})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  return null;
};
