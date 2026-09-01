import { random } from "remotion";
import { BLUR, makeCache } from "./buffers";
import type { Buffers } from "./buffers";
import type { ScreenState } from "./state";
import type { Palette } from "./variants";

/** Grain, scanlines, vignette and bloom — the pass that sells the screen. */

const VIGNETTE_STRENGTH = 0.22;
const SCANLINE_PITCH = 5;
const SCANLINE_ALPHA = 0.03;
const GRAIN_ALPHA = 0.04;
const GRAIN_TILE = 256;

export type FinishCaches = {
  scanlines: HTMLCanvasElement;
  grain: HTMLCanvasElement;
};

export const buildFinishCaches = (): FinishCaches => {
  const lines = makeCache(1, SCANLINE_PITCH);
  lines.fillStyle = `rgba(0,0,0,${SCANLINE_ALPHA})`;
  lines.fillRect(0, 0, 1, 1);

  const grain = makeCache(GRAIN_TILE, GRAIN_TILE);
  const image = grain.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
    const v = 128 + Math.round((random(`grain-${i}`) - 0.5) * 150);
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  grain.putImageData(image, 0, 0);

  return { scanlines: lines.canvas, grain: grain.canvas };
};

/** Flattens the depth buffers onto the visible canvas, blooming the dialog. */
export const composite = (
  ctx: CanvasRenderingContext2D,
  buffers: Buffers,
  palette: Palette,
  width: number,
  height: number,
): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";

  ctx.fillStyle = palette.backgroundDeep;
  ctx.fillRect(0, 0, width, height);

  ctx.filter = `blur(${BLUR.far}px)`;
  ctx.drawImage(buffers.far.canvas, 0, 0, width, height);
  ctx.filter = `blur(${BLUR.mid}px)`;
  ctx.drawImage(buffers.mid.canvas, 0, 0, width, height);
  ctx.filter = "none";

  // Moderate bloom. Only the bright parts of the near buffer — the border,
  // the icon and the progress fill — contribute anything visible.
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.5;
  ctx.filter = `blur(${BLUR.bloom}px)`;
  ctx.drawImage(buffers.near.canvas, 0, 0, width, height);
  ctx.filter = "none";

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(buffers.near.canvas, 0, 0, width, height);
};

export const finish = (
  ctx: CanvasRenderingContext2D,
  caches: FinishCaches,
  state: ScreenState,
  width: number,
  height: number,
): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.28,
    width / 2,
    height / 2,
    height * 0.92,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${VIGNETTE_STRENGTH})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const lines = ctx.createPattern(caches.scanlines, "repeat");
  if (lines) {
    ctx.fillStyle = lines;
    ctx.fillRect(0, 0, width, height);
  }

  const grain = ctx.createPattern(caches.grain, "repeat");
  if (grain) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = GRAIN_ALPHA;
    ctx.translate(
      -Math.floor(random(`grain-x-${state.frame}`) * GRAIN_TILE),
      -Math.floor(random(`grain-y-${state.frame}`) * GRAIN_TILE),
    );
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width + GRAIN_TILE, height + GRAIN_TILE);
    ctx.restore();
  }

  if (state.fadeToBlack > 0) {
    ctx.fillStyle = `rgba(0,0,0,${state.fadeToBlack})`;
    ctx.fillRect(0, 0, width, height);
  }
};
