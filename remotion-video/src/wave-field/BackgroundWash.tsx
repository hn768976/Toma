import { HEIGHT, WIDTH } from "./constants";
import { shade, withAlpha } from "./color";
import type { VariantConfig } from "./variants";

export interface BackgroundWashProps {
  ctx: CanvasRenderingContext2D;
  cfg: VariantConfig;
}

export const drawBackgroundWash = (ctx: CanvasRenderingContext2D, cfg: VariantConfig) => {
  const { palette } = cfg;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.backgroundDeep;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A single broad wash, off-centre to the right, so the ground has a
  // direction to it rather than reading as a flat fill.
  const wash = ctx.createRadialGradient(
    WIDTH * 0.6,
    HEIGHT * 0.46,
    0,
    WIDTH * 0.6,
    HEIGHT * 0.46,
    WIDTH * 0.78,
  );
  wash.addColorStop(0, withAlpha(palette.backgroundWash, 0.95));
  wash.addColorStop(0.45, withAlpha(palette.backgroundWash, 0.5));
  wash.addColorStop(1, withAlpha(palette.backgroundWash, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A counter-wash pulls the lower-left corner down toward the deep tone.
  const corner = ctx.createRadialGradient(
    WIDTH * 0.05,
    HEIGHT * 0.95,
    0,
    WIDTH * 0.05,
    HEIGHT * 0.95,
    WIDTH * 0.6,
  );
  corner.addColorStop(0, withAlpha(shade(palette.backgroundDeep, 0.55), 0.9));
  corner.addColorStop(1, withAlpha(shade(palette.backgroundDeep, 0.55), 0));
  ctx.fillStyle = corner;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/** Draws the ground into the background buffer during render. */
export const BackgroundWash: React.FC<BackgroundWashProps> = ({ ctx, cfg }) => {
  drawBackgroundWash(ctx, cfg);
  return null;
};
