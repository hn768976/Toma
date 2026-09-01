import { useMemo } from "react";
import { random } from "remotion";
import type { Buffers } from "../buffers";
import { lighten, withAlpha } from "../colors";
import { applyDialogSpace } from "../dialog-space";
import { MONO, SANS } from "../fonts";
import type { Layout } from "../layout";
import type { Painter } from "../painter";
import { LAYER } from "../painter";
import type { ScreenState } from "../state";
import type { Palette } from "../variants";

/**
 * The progress bar, and the large caps banner that replaces it once the
 * outcome lands.
 *
 * The fill carries diagonal hatching that scrolls continuously along the bar.
 * That scroll is what makes the bar read as active work rather than as a
 * static coloured rectangle — and the stripe widths are deliberately irregular
 * so the pattern never lines up with the frame rate and strobes.
 */

const HATCH_PERIOD_TARGET = 900;

type Stripe = { o: number; w: number };

const buildStripes = (): { list: Stripe[]; period: number } => {
  const list: Stripe[] = [];
  let u = 0;
  let i = 0;
  while (u < HATCH_PERIOD_TARGET) {
    const w = 16 + random(`hatch-w-${i}`) * 15;
    const gap = 19 + random(`hatch-g-${i}`) * 17;
    list.push({ o: u, w });
    u += w + gap;
    i++;
  }
  return { list, period: u };
};

const setLetterSpacing = (ctx: CanvasRenderingContext2D, px: number): void => {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
};

export const ProgressBar: React.FC<{
  painter: Painter;
  buffers: Buffers;
  layout: Layout;
  palette: Palette;
  state: ScreenState;
}> = ({ painter, buffers, layout, palette, state }) => {
  const stripes = useMemo(buildStripes, []);

  painter.register("progress", LAYER.progressBar, () => {
    if (state.contentAlpha <= 0) return;
    const ctx = buffers.near.ctx;
    const { bar, banner } = layout;
    applyDialogSpace(ctx, buffers.near.matrix, layout, state.dialogScale);
    ctx.globalAlpha = state.contentAlpha * state.dialogAlpha;

    if (state.swapped) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${banner.size}px ${SANS}`;
      setLetterSpacing(ctx, banner.size * 0.06);
      ctx.fillStyle = palette.textBright;
      ctx.shadowColor = withAlpha(palette.dialogBorder, 0.8);
      ctx.shadowBlur = 40;
      ctx.fillText(state.labelBanner, banner.x, banner.y);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      setLetterSpacing(ctx, 0);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 1;
      return;
    }

    // Track.
    ctx.fillStyle = palette.barTrack;
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
    ctx.strokeStyle = withAlpha(palette.dialogBorder, 0.85);
    ctx.lineWidth = 3;
    ctx.strokeRect(bar.x + 1.5, bar.y + 1.5, bar.w - 3, bar.h - 3);

    const inset = 5;
    const fx = bar.x + inset;
    const fy = bar.y + inset;
    const fh = bar.h - inset * 2;
    const fullW = bar.w - inset * 2;
    const fillW = (fullW * state.progress) / 100;

    if (fillW > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy, fillW, fh);
      ctx.clip();

      ctx.fillStyle = state.fillColor;
      ctx.globalAlpha = state.contentAlpha * state.dialogAlpha * 0.9;
      ctx.fillRect(fx, fy, fillW, fh);

      // Diagonal hatching at 45 degrees, scrolling along the bar.
      const shift = state.hatchOffset % stripes.period;
      ctx.fillStyle = lighten(state.fillColor, 0.5);
      ctx.globalAlpha = state.contentAlpha * state.dialogAlpha * 0.5;
      const tiles = Math.ceil((fillW + fh) / stripes.period) + 2;
      for (let t = -1; t < tiles; t++) {
        const base = fx + shift + t * stripes.period;
        for (const s of stripes.list) {
          const u = base + s.o;
          ctx.beginPath();
          ctx.moveTo(u, fy + fh);
          ctx.lineTo(u + s.w, fy + fh);
          ctx.lineTo(u + s.w + fh, fy);
          ctx.lineTo(u + fh, fy);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

      // Bright leading edge.
      ctx.globalAlpha = state.contentAlpha * state.dialogAlpha;
      ctx.fillStyle = lighten(state.fillColor, 0.75);
      ctx.fillRect(fx + fillW - 4, fy, 4, fh);
    }

    // The percentage rides the fill's leading edge. Monospace, so its digits
    // are tabular and the value does not jitter as they change.
    const label = `${Math.round(state.progress)}%`;
    ctx.font = `500 ${bar.h * 0.62}px ${MONO}`;
    ctx.textBaseline = "middle";
    ctx.shadowColor = withAlpha(palette.barTrack, 0.95);
    ctx.shadowBlur = 14;
    const midY = bar.y + bar.h / 2;
    const textW = ctx.measureText(label).width;
    if (fillW > textW + 46) {
      ctx.textAlign = "right";
      ctx.fillStyle = palette.textBright;
      ctx.fillText(label, fx + fillW - 22, midY);
    } else {
      ctx.textAlign = "left";
      ctx.fillStyle = palette.textPale;
      ctx.fillText(label, fx + fillW + 22, midY);
    }
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  });

  return null;
};
