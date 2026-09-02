import { rndInt } from "../random/seeded";

// The chrome every panel in the frame shares: a 2px border, small corner
// ticks, and a tiny label strip along the top edge. Palette-agnostic — the
// caller passes the four colours it wants.

export type ChromeColors = {
  fill: string;
  border: string;
  tick: string;
  labelText: string;
  labelStrip: string;
};

export type ChromeOpts = {
  w: number;
  h: number;
  label?: string;
  labelFont: string;
  colors: ChromeColors;
  borderWidth?: number;
  labelHeight?: number;
  cornerTick?: number;
  /** Draw only the corner brackets and label, leaving the sides open. */
  bracketOnly?: boolean;
  letterSpacing?: string;
};

/**
 * Rasterise a panel's static chrome. Call inside useMemo and blit the result;
 * nothing in here changes from frame to frame.
 */
export const drawPanelChrome = (ctx: CanvasRenderingContext2D, o: ChromeOpts) => {
  const {
    w,
    h,
    label,
    labelFont,
    colors,
    borderWidth = 2,
    labelHeight = 38,
    cornerTick = 20,
    bracketOnly = false,
    letterSpacing = "3px",
  } = o;
  const half = borderWidth / 2;

  ctx.fillStyle = colors.fill;
  ctx.fillRect(0, 0, w, h);

  if (bracketOnly) {
    // Corner brackets only — the "open" panels (the centre stage, the empty
    // bracket panel) read as a frame rather than a box.
    const armX = Math.min(w * 0.14, 120);
    const armY = Math.min(h * 0.14, 120);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = borderWidth;
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [
      [half, half, 1, 1],
      [w - half, half, -1, 1],
      [half, h - half, 1, -1],
      [w - half, h - half, -1, -1],
    ] as const) {
      ctx.moveTo(cx + sx * armX, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * armY);
    }
    ctx.stroke();
  } else {
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(half, half, w - borderWidth, h - borderWidth);
  }

  if (label !== undefined) {
    if (!bracketOnly) {
      ctx.fillStyle = colors.labelStrip;
      ctx.fillRect(borderWidth, borderWidth, w - borderWidth * 2, labelHeight);
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(borderWidth, borderWidth + labelHeight + 0.5);
      ctx.lineTo(w - borderWidth, borderWidth + labelHeight + 0.5);
      ctx.stroke();
    }
    ctx.save();
    ctx.font = labelFont;
    ctx.letterSpacing = letterSpacing;
    ctx.fillStyle = colors.labelText;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(label.toUpperCase(), borderWidth + 14, borderWidth + labelHeight / 2 + 1);
    ctx.restore();
  }

  // Corner ticks: short L-marks sitting just inside each corner.
  ctx.strokeStyle = colors.tick;
  ctx.lineWidth = borderWidth;
  const inset = borderWidth + 8;
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ] as const) {
    ctx.moveTo(cx + sx * cornerTick, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * cornerTick);
  }
  ctx.stroke();
};

/**
 * Which panel is flashing, and how hard.
 *
 * One flash slot every `slotFrames`, and each slot picks exactly one panel —
 * so the whole dashboard averages a steady 3 border flashes a second with no
 * two ever overlapping. Seeded on the slot index, which is derived from the
 * already-wrapped frame, so the pattern repeats exactly on the loop.
 */
export const panelFlash = (
  loopedFrame: number,
  panelIndex: number,
  panelCount: number,
  slotFrames: number,
  flashLength: number,
): number => {
  const slot = Math.floor(loopedFrame / slotFrames);
  if (rndInt(`border-flash-${slot}`, 0, panelCount - 1) !== panelIndex) return 0;
  const age = loopedFrame - slot * slotFrames;
  if (age >= flashLength) return 0;
  return 1 - age / flashLength;
};

/** The bright border overlay drawn on top of a flashing panel's chrome. */
export const drawBorderFlash = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
  color: string,
  borderWidth = 2,
) => {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount * 0.85;
  ctx.strokeStyle = color;
  ctx.lineWidth = borderWidth;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * amount;
  ctx.strokeRect(borderWidth / 2, borderWidth / 2, w - borderWidth, h - borderWidth);
  ctx.restore();
};

/** Small-caps technical label, the frame's default text treatment. */
export const smallCaps = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: {
    font: string;
    color: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    spacing?: string;
    alpha?: number;
  },
) => {
  ctx.save();
  ctx.font = o.font;
  ctx.letterSpacing = o.spacing ?? "3px";
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.baseline ?? "middle";
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
};
