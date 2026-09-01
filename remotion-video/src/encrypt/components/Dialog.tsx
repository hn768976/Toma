import { withAlpha } from "../colors";
import { applyDialogSpace } from "../dialog-space";
import { SANS } from "../fonts";
import type { Buffers } from "../buffers";
import type { Layout } from "../layout";
import type { Painter } from "../painter";
import { LAYER } from "../painter";
import type { ScreenState } from "../state";
import type { Palette } from "../variants";

/**
 * The subject: a deliberately generic panel. Square corners, a flat title bar
 * with two square indicator dots, a semi-transparent body, a thin border with
 * a brighter top and left edge, and a soft outer glow so it reads as lit and
 * floating above the backdrop. Nothing here belongs to any real operating
 * system.
 */

const setLetterSpacing = (ctx: CanvasRenderingContext2D, px: number): void => {
  // Not in every DOM lib version, but supported by the renderer's Chrome.
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
};

export const Dialog: React.FC<{
  painter: Painter;
  buffers: Buffers;
  layout: Layout;
  palette: Palette;
  state: ScreenState;
}> = ({ painter, buffers, layout, palette, state }) => {
  painter.register("dialog", LAYER.dialog, () => {
    if (state.dialogAlpha <= 0 || state.borderDraw <= 0) return;
    const ctx = buffers.near.ctx;
    const { dialog, titleBar, body } = layout;
    const shellAlpha = Math.min(1, state.borderDraw * 1.3) * state.dialogAlpha;

    applyDialogSpace(ctx, buffers.near.matrix, layout, state.dialogScale);

    // Soft outer glow.
    ctx.globalAlpha = shellAlpha;
    ctx.shadowColor = withAlpha(palette.dialogBorder, 0.5);
    ctx.shadowBlur = 95;
    ctx.fillStyle = palette.dialogFill;
    ctx.fillRect(dialog.x, dialog.y, dialog.w, dialog.h);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Body: semi-transparent dark fill.
    ctx.fillStyle = withAlpha(palette.dialogFill, palette.dialogFillAlpha);
    ctx.fillRect(body.x, body.y, body.w, body.h);

    // Title bar: a flat solid colour.
    ctx.fillStyle = state.titleBarColor;
    ctx.fillRect(titleBar.x, titleBar.y, titleBar.w, titleBar.h);

    // Thin border, drawing itself on before any contents appear.
    const perimeter = 2 * (dialog.w + dialog.h);
    ctx.globalAlpha = state.dialogAlpha;
    ctx.strokeStyle = palette.dialogBorder;
    ctx.lineWidth = 4;
    ctx.setLineDash([perimeter, perimeter]);
    ctx.lineDashOffset = perimeter * (1 - state.borderDraw);
    ctx.beginPath();
    ctx.rect(dialog.x, dialog.y, dialog.w, dialog.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // A subtly brighter edge along the top and the left.
    ctx.globalAlpha = state.dialogAlpha * 0.55 * state.borderDraw;
    ctx.strokeStyle = palette.textBright;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dialog.x + 2, dialog.y + dialog.h - 2);
    ctx.lineTo(dialog.x + 2, dialog.y + 2);
    ctx.lineTo(dialog.x + dialog.w - 2, dialog.y + 2);
    ctx.stroke();

    // Separator under the title bar.
    ctx.globalAlpha = state.dialogAlpha * 0.5 * state.borderDraw;
    ctx.strokeStyle = palette.dialogBorder;
    ctx.beginPath();
    ctx.moveTo(dialog.x, body.y);
    ctx.lineTo(dialog.x + dialog.w, body.y);
    ctx.stroke();

    if (state.contentAlpha <= 0) {
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = state.contentAlpha * state.dialogAlpha;

    // Two generic square indicator dots at the title bar's left.
    const dot = titleBar.h * 0.34;
    const dotY = titleBar.y + (titleBar.h - dot) / 2;
    ctx.fillStyle = palette.dotRed;
    ctx.fillRect(titleBar.x + titleBar.h * 0.36, dotY, dot, dot);
    ctx.fillStyle = palette.dotGreen;
    ctx.fillRect(titleBar.x + titleBar.h * 0.36 + dot * 1.5, dotY, dot, dot);

    // Title, centred, in small caps.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${titleBar.h * 0.5}px ${SANS}`;
    setLetterSpacing(ctx, titleBar.h * 0.1);
    ctx.fillStyle = palette.titleText;
    ctx.fillText(
      state.titleText.toUpperCase(),
      titleBar.x + titleBar.w / 2,
      titleBar.y + titleBar.h * 0.54,
    );
    setLetterSpacing(ctx, 0);

    // The status line under the progress bar.
    if (!state.swapped) {
      ctx.font = `400 ${layout.statusLine.size}px ${SANS}`;
      ctx.fillStyle = palette.textBright;
      ctx.fillText(state.statusText, layout.statusLine.x, layout.statusLine.y);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  });

  return null;
};
