import type { Buffers } from "../buffers";
import { applyDialogSpace } from "../dialog-space";
import type { Layout } from "../layout";
import type { Painter } from "../painter";
import { LAYER } from "../painter";
import type { ScreenState } from "../state";
import type { IconKind, Palette } from "../variants";

/**
 * The padlock, the checkmark and the opened padlock, all drawn as thick
 * glowing outlines at the same scale so the swap reads as one object changing
 * state rather than as two different pictures.
 */

/** Shackle geometry, as fractions of the icon box. */
const SHACKLE_RADIUS = 0.21;
const SHACKLE_LEG = 0.15;
const BODY_TOP = -0.02;
const BODY_H = 0.44;
const BODY_W = 0.6;
const OPEN_ANGLE_DEG = 38;

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.closePath();
};

const drawShackle = (
  ctx: CanvasRenderingContext2D,
  s: number,
  angleDeg: number,
): void => {
  const r = SHACKLE_RADIUS * s;
  const legTop = BODY_TOP * s - SHACKLE_LEG * s;
  const bodyTop = BODY_TOP * s;

  ctx.save();
  if (angleDeg !== 0) {
    // Pivot on the shackle's own attachment point, never the icon centre —
    // rotating about the centre reads as a broken lock, not an opened one.
    ctx.translate(r, bodyTop);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.translate(-r, -bodyTop);
  }
  ctx.beginPath();
  ctx.moveTo(-r, bodyTop);
  ctx.lineTo(-r, legTop);
  ctx.arc(0, legTop, r, Math.PI, 0);
  ctx.lineTo(r, bodyTop);
  ctx.stroke();
  ctx.restore();
};

const drawPadlock = (
  ctx: CanvasRenderingContext2D,
  s: number,
  angleDeg: number,
): void => {
  drawShackle(ctx, s, angleDeg);

  roundedRect(
    ctx,
    (-BODY_W / 2) * s,
    BODY_TOP * s,
    BODY_W * s,
    BODY_H * s,
    0.055 * s,
  );
  ctx.stroke();

  // Keyhole cut from the body.
  const ky = BODY_TOP * s + BODY_H * s * 0.42;
  ctx.beginPath();
  ctx.arc(0, ky, 0.055 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, ky + 0.045 * s);
  ctx.lineTo(0, ky + 0.14 * s);
  ctx.stroke();
};

const drawCheckCircle = (
  ctx: CanvasRenderingContext2D,
  s: number,
  draw: number,
): void => {
  const r = 0.37 * s;
  const from = -0.42 * Math.PI;
  const sweep = 1.86 * Math.PI;
  ctx.beginPath();
  ctx.arc(0, 0, r, from, from + sweep * draw);
  ctx.stroke();

  const pts: [number, number][] = [
    [-0.19 * s, 0.02 * s],
    [-0.04 * s, 0.2 * s],
    [0.27 * s, -0.24 * s],
  ];
  const len =
    Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) +
    Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  ctx.save();
  ctx.setLineDash([len, len]);
  ctx.lineDashOffset = len * (1 - draw);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.stroke();
  ctx.restore();
};

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

export const StatusIcon: React.FC<{
  painter: Painter;
  buffers: Buffers;
  layout: Layout;
  palette: Palette;
  state: ScreenState;
}> = ({ painter, buffers, layout, palette, state }) => {
  painter.register("icon", LAYER.icon, () => {
    if (state.contentAlpha <= 0) return;
    const ctx = buffers.near.ctx;
    const { icon } = layout;
    const s = icon.w;

    applyDialogSpace(ctx, buffers.near.matrix, layout, state.dialogScale);
    ctx.translate(icon.x + icon.w / 2, icon.y + icon.h / 2 - 0.02 * s);
    ctx.scale(state.iconPulse, state.iconPulse);

    ctx.globalAlpha = state.contentAlpha * state.dialogAlpha;
    ctx.lineWidth = 0.072 * s;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = state.iconStroke;
    ctx.shadowColor = state.iconGlow;
    ctx.shadowBlur = 42;

    const kind: IconKind = state.icon;
    if (kind === "checkCircle") {
      drawCheckCircle(ctx, s, state.iconDraw);
    } else {
      drawPadlock(
        ctx,
        s,
        kind === "padlockOpen"
          ? OPEN_ANGLE_DEG * easeOut(Math.min(1, state.iconDraw * 1.8))
          : 0,
      );
    }

    // A hard cross straight across the padlock. No easing, no draw-on.
    // It is knocked out of the padlock first so both shapes stay readable.
    if (state.crossOn) {
      const k = 0.37 * s;
      const cross = () => {
        ctx.beginPath();
        ctx.moveTo(-k, -k);
        ctx.lineTo(k, k);
        ctx.moveTo(k, -k);
        ctx.lineTo(-k, k);
        ctx.stroke();
      };
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = palette.dialogFill;
      ctx.lineWidth = 0.105 * s;
      cross();
      ctx.strokeStyle = state.iconStroke;
      ctx.shadowColor = state.iconGlow;
      ctx.shadowBlur = 42;
      ctx.lineWidth = 0.052 * s;
      cross();
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.globalAlpha = 1;
  });

  return null;
};
