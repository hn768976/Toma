/**
 * A circular gauge: a full-circle track, and an arc that fills clockwise from
 * 12 o'clock to `value` (0..1).
 *
 * Split into a track pass and an arc pass because the track never changes —
 * rasterise it once into a sprite and only redraw the arc per frame.
 */
export const drawGaugeTrack = (
  ctx: CanvasRenderingContext2D,
  o: { cx: number; cy: number; radius: number; width: number; color: string },
) => {
  ctx.strokeStyle = o.color;
  ctx.lineWidth = o.width;
  ctx.beginPath();
  ctx.arc(o.cx, o.cy, o.radius, 0, Math.PI * 2);
  ctx.stroke();
};

export const drawGaugeArc = (
  ctx: CanvasRenderingContext2D,
  o: {
    cx: number;
    cy: number;
    radius: number;
    width: number;
    /** 0..1 of a full turn. */
    value: number;
    color: string;
    glow?: number;
    /** Defaults to 12 o'clock. */
    startAngle?: number;
    cap?: CanvasLineCap;
  },
) => {
  const { cx, cy, radius, width, value, color, glow = 0, cap = "round" } = o;
  const start = o.startAngle ?? -Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, start + Math.PI * 2 * value);
  ctx.stroke();
  ctx.restore();
};
