/**
 * Multi-pass neon stroking.
 *
 * A convincing neon tube is not one glowing stroke but several, composited
 * additively: a wide, very faint atmospheric halo, a tighter glow, a bright
 * mid channel, and finally a thin near-white core with no blur at all. The
 * core is what the eye reads as "lit"; the outer passes are what make it feel
 * like it is emitting into the air around it.
 *
 * Colours are supplied by the caller, so this knows nothing about any palette.
 */

export type NeonPass = {
  /** Stroke width in device pixels. */
  width: number;
  /** Canvas shadowBlur radius; 0 for the hot core. */
  blur: number;
  alpha: number;
  color: string;
};

export type NeonOptions = {
  /** Scales every pass's alpha, e.g. for a pulse. */
  intensity?: number;
  /** Scales every pass's blur radius. */
  bloomScale?: number;
  lineJoin?: CanvasLineJoin;
  lineCap?: CanvasLineCap;
};

/**
 * Builds a standard four-pass ramp from a mid colour and a hot core colour.
 * `unit` scales all widths and blurs together, so the same ramp works for a
 * 900px centrepiece and a 60px scattered mark.
 */
export const neonPasses = (
  midColor: string,
  coreColor: string,
  unit: number,
): NeonPass[] => [
  { width: unit * 5.0, blur: unit * 17.5, alpha: 0.1, color: midColor },
  { width: unit * 3.2, blur: unit * 7.5, alpha: 0.22, color: midColor },
  { width: unit * 2.1, blur: unit * 2.5, alpha: 0.5, color: midColor },
  { width: unit * 1.0, blur: 0, alpha: 0.95, color: coreColor },
];

/** Strokes every path once per pass, compositing the passes additively. */
export const neonStroke = (
  ctx: CanvasRenderingContext2D,
  paths: Path2D[],
  passes: NeonPass[],
  options: NeonOptions = {},
): void => {
  const {
    intensity = 1,
    bloomScale = 1,
    lineJoin = "round",
    lineCap = "round",
  } = options;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = lineJoin;
  ctx.lineCap = lineCap;
  for (const pass of passes) {
    ctx.globalAlpha = Math.max(0, Math.min(1, pass.alpha * intensity));
    ctx.lineWidth = pass.width;
    ctx.strokeStyle = pass.color;
    ctx.shadowColor = pass.color;
    ctx.shadowBlur = pass.blur * bloomScale;
    for (const path of paths) ctx.stroke(path);
  }
  ctx.restore();
};

/** Fills every path once per pass — used for solid dots inside a glyph. */
export const neonFill = (
  ctx: CanvasRenderingContext2D,
  paths: Path2D[],
  passes: NeonPass[],
  options: NeonOptions = {},
): void => {
  const { intensity = 1, bloomScale = 1 } = options;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const pass of passes) {
    ctx.globalAlpha = Math.max(0, Math.min(1, pass.alpha * intensity));
    ctx.fillStyle = pass.color;
    ctx.shadowColor = pass.color;
    ctx.shadowBlur = pass.blur * bloomScale;
    for (const path of paths) ctx.fill(path);
  }
  ctx.restore();
};
