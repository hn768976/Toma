import { random } from "remotion";
import type { Buffers } from "../buffers";
import type { Painter } from "../painter";
import { LAYER } from "../painter";
import type { ScreenState } from "../state";
import type { Palette } from "../variants";

/**
 * The transition: the flash that hides the contents swapping underneath it,
 * and — on the failing version — the glitch that goes with it.
 */

const SLICE_SHIFT_MIN = 40;
const SLICE_SHIFT_MAX = 180;
const CHANNEL_SPLIT = 20;

export const FlashPass: React.FC<{
  painter: Painter;
  getCtx: () => CanvasRenderingContext2D | null;
  buffers: Buffers;
  palette: Palette;
  state: ScreenState;
  width: number;
  height: number;
}> = ({ painter, getCtx, buffers, palette, state, width, height }) => {
  painter.register("flash", LAYER.flash, () => {
    const ctx = getCtx();
    if (!ctx) return;

    if (state.glitchOn) {
      const scratch = buffers.scratch;

      // The dialog's colour channels pull apart.
      scratch.ctx.setTransform(1, 0, 0, 1, 0, 0);
      scratch.ctx.globalCompositeOperation = "source-over";
      for (const [colour, dx] of [
        [palette.channelA, -CHANNEL_SPLIT],
        [palette.channelB, CHANNEL_SPLIT],
      ] as const) {
        scratch.ctx.clearRect(0, 0, width, height);
        scratch.ctx.drawImage(buffers.near.canvas, 0, 0);
        scratch.ctx.globalCompositeOperation = "source-atop";
        scratch.ctx.fillStyle = colour;
        scratch.ctx.fillRect(0, 0, width, height);
        scratch.ctx.globalCompositeOperation = "source-over";

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.5;
        ctx.drawImage(scratch.canvas, dx, 0);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      // Thin horizontal slices shift sideways.
      scratch.ctx.clearRect(0, 0, width, height);
      scratch.ctx.drawImage(ctx.canvas, 0, 0);
      const seed = `glitch-${state.frame}`;
      const slices = 5 + Math.floor(random(`${seed}-n`) * 3);
      for (let i = 0; i < slices; i++) {
        const y = random(`${seed}-y-${i}`) * height;
        const h = 18 + random(`${seed}-h-${i}`) * 70;
        const dir = random(`${seed}-d-${i}`) < 0.5 ? -1 : 1;
        const shift =
          dir *
          (SLICE_SHIFT_MIN +
            random(`${seed}-s-${i}`) * (SLICE_SHIFT_MAX - SLICE_SHIFT_MIN));
        ctx.fillStyle = palette.backgroundDeep;
        ctx.fillRect(0, y, width, h);
        ctx.drawImage(scratch.canvas, 0, y, width, h, shift, y, width, h);
      }
    }

    if (state.flashAlpha > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = state.flashAlpha;
      ctx.fillStyle = palette.flash;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
  });

  return null;
};
