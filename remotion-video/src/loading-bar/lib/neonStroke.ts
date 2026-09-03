/**
 * Four-pass neon stroke.
 *
 * A single blurred stroke reads as a drop shadow, not as light. Real
 * neon has a wide atmospheric halo, a tighter outer bloom, a mid
 * channel and a near-white core, and it is the *ratio* between those
 * four that sells it. Every pass is composited with 'lighter' so the
 * overlaps sum toward white exactly the way emitted light does.
 *
 * `path` is re-invoked per pass rather than cached, so callers can hand
 * in any path-building closure without worrying about Path2D support.
 */
export type NeonPass = {
  color: string;
  alpha: number;
  lineWidth: number;
  blur: number;
};

/** Wide halo -> outer glow -> mid channel -> hot core. */
export const neonPasses = (
  glowColor: string,
  coreColor: string,
  scale: number,
): NeonPass[] => [
  { color: glowColor, alpha: 0.1, lineWidth: 11 * scale, blur: 60 * scale },
  { color: glowColor, alpha: 0.22, lineWidth: 8 * scale, blur: 26 * scale },
  { color: glowColor, alpha: 0.55, lineWidth: 5.5 * scale, blur: 9 * scale },
  { color: coreColor, alpha: 0.92, lineWidth: 2.6 * scale, blur: 0 },
];

export const neonStroke = (
  ctx: CanvasRenderingContext2D,
  path: (ctx: CanvasRenderingContext2D) => void,
  passes: NeonPass[],
): void => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const pass of passes) {
    ctx.globalAlpha = pass.alpha;
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = pass.lineWidth;
    ctx.shadowBlur = pass.blur;
    ctx.shadowColor = pass.blur > 0 ? pass.color : "rgba(0, 0, 0, 0)";
    path(ctx);
    ctx.stroke();
  }
  ctx.restore();
};
