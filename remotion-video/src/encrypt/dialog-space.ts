import type { Matrix } from "./plane";
import { applyMatrix } from "./plane";
import type { Layout } from "./layout";

/**
 * Plane space with the dialog's spring scale applied about its own centre, so
 * the dialog, its icon and its progress bar all scale in as one object and
 * inherit the tilt. A frontal dialog on a tilted field reads as pasted on.
 */
export const applyDialogSpace = (
  ctx: CanvasRenderingContext2D,
  m: Matrix,
  layout: Layout,
  scale: number,
): void => {
  applyMatrix(ctx, m);
  const cx = layout.dialog.x + layout.dialog.w / 2;
  const cy = layout.dialog.y + layout.dialog.h / 2;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
};
