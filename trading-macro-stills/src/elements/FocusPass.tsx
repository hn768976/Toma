import { useLayoutEffect } from "react";
import { blurred, context2d, makeCanvas } from "../lib/canvas";
import { ink, rgba } from "../lib/color";
import type { Rng } from "../lib/rng";
import type { Scene } from "../scene";
import type { Palette } from "../palettes";

const GRAIN_TILE = 384;

const grainTile = (rng: Rng): HTMLCanvasElement => {
  const c = makeCanvas(GRAIN_TILE, GRAIN_TILE);
  const ctx = context2d(c);
  const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.round(rng.next() * 36);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/**
 * Develops the still: background, then the five depth buffers blurred ONE
 * time each and added far-to-near, then the flare, then the camera grade.
 *
 * Each buffer is blurred with a brightness boost applied first, so a bright
 * numeric field sitting well off the focus plane spreads into soft glowing
 * marks instead of simply going dim.
 */
export const FocusPass: React.FC<{ scene: Scene; palette: Palette }> = ({
  scene,
  palette,
}) => {
  useLayoutEffect(() => {
    const canvas = scene.output.current;
    if (!canvas) return;
    const ctx = context2d(canvas);
    const { width: W, height: H, comp } = scene;
    const bg = comp.background;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(palette, "bg", 1);
    ctx.fillRect(0, 0, W, H);

    const wash = ctx.createRadialGradient(
      bg.tintX * W,
      bg.tintY * H,
      0,
      bg.tintX * W,
      bg.tintY * H,
      Math.hypot(W, H) * 0.75,
    );
    wash.addColorStop(0, rgba(palette, bg.tint, bg.tintAlpha));
    wash.addColorStop(1, rgba(palette, bg.tint, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";
    for (const bracket of scene.brackets) {
      const out = blurred(bracket.canvas, bracket.blur, bracket.bloom);
      ctx.globalAlpha = bg.exposure;
      ctx.drawImage(out, 0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(scene.flare.canvas, 0, 0);

    ctx.globalCompositeOperation = "source-over";
    const vig = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.25,
      W / 2,
      H / 2,
      Math.hypot(W, H) * 0.62,
    );
    vig.addColorStop(0, ink(0));
    vig.addColorStop(1, ink(bg.vignette));
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (bg.grain > 0) {
      const tile = grainTile(scene.rng.fork("grain"));
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = bg.grain;
      const step = GRAIN_TILE * 2.5;
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          ctx.drawImage(tile, x, y, step, step);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }, [scene, palette]);

  return null;
};
