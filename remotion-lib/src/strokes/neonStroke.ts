/**
 * neonStroke — the four-pass neon construction.
 *
 * WHAT: Strokes one path several times at decreasing width and increasing
 * opacity, composited with `globalCompositeOperation = 'lighter'`, so the
 * accumulated light builds a wide dim halo around a narrow hot core.
 *
 * WHY THIS AND NOT ONE THICK STROKE: a single thick semi-transparent stroke
 * produces a flat band of uniform colour with a hard edge. It does not read as
 * light. Light falls off with distance, and additive compositing is what
 * reproduces that: where passes overlap near the centre their alphas sum toward
 * white, and the falloff to the outer halo is smooth because each pass is
 * wider and fainter than the one inside it. This is the single most repeated
 * technique across the source projects (51 of them) and it was rebuilt from
 * scratch in 122 different files.
 *
 * WHY NOT shadowBlur: some source projects used `ctx.shadowBlur` instead. It is
 * cheaper for a handful of large glyphs, but the blur radius is capped by the
 * implementation, it does not scale with the canvas, and over a long polyline
 * it is dramatically slower than restroking. The pass array is the form that
 * survived, so it is what is extracted here. `blur` is offered per pass for the
 * cases where you genuinely want a soft atmospheric wash on the widest pass.
 *
 * THE DEFAULT PASSES, and what each is doing:
 *   1. atmosphere  x9.0 width, alpha 0.05 — the wide glow that sells the light
 *                  spilling into the surrounding air.
 *   2. outer       x4.5 width, alpha 0.10 — bridges atmosphere to channel.
 *   3. channel     x2.0 width, alpha 0.30 — the visible body of the tube.
 *   4. core        x1.0 width, alpha 1.00 — the thin hot centre. Drawn in
 *                  `coreColor`, which should be much closer to white than
 *                  `color`; this is what makes it read as hot rather than
 *                  merely bright.
 *
 * PARAMETERS
 *   ctx        Target context.
 *   path       A thunk that lays the geometry. Called once per pass, so keep it
 *              cheap — build a Path2D outside and stroke it inside if the
 *              geometry is expensive.
 *   color      Halo colour. Any CSS colour string.
 *   coreColor  Colour of the hot core. Defaults to `color`, but you almost
 *              always want something near white here.
 *   width      Width of the CORE in px. Every pass multiplies this.
 *   passes     Override the pass list entirely. Defaults to the four above.
 *   intensity  Scales every pass alpha at once. Default 1. Animate this to
 *              flicker or pulse without rebuilding the pass array.
 *
 * NO COLOURS ARE BAKED IN. `color` and `coreColor` are required inputs.
 *
 * GOTCHA: `'lighter'` only accumulates toward white against a DARK ground. On a
 * light background the passes wash out and you get a pale smear. If you need
 * neon on white, draw it into an offscreen buffer over black and composite that
 * buffer with `'screen'` or `'multiply'` as the design requires.
 *
 * GOTCHA: alphas are additive, so a long path that crosses itself will be
 * brighter at the crossing. That is physically right and usually what you want,
 * but it means you cannot use this to draw a uniform-brightness closed shape.
 *
 * EXAMPLE
 *   neonStroke({
 *     ctx,
 *     path: (c) => { c.beginPath(); c.moveTo(100, 400); c.lineTo(900, 300); },
 *     color: '#2E6BFF',
 *     coreColor: '#EAF4FF',
 *     width: 3,
 *   });
 */
import type { Ctx, PathFn } from '../types';

export type NeonPass = {
  /** Multiplier on the core width. */
  widthMul: number;
  /** Multiplier on `intensity`, giving this pass's globalAlpha. */
  alphaMul: number;
  /** If true this pass uses `coreColor` rather than `color`. */
  core?: boolean;
  /** Optional canvas blur in px applied to this pass only. */
  blur?: number;
};

/**
 * The four-pass default: wide atmospheric glow, outer glow, mid channel,
 * thin hot core.
 */
export const DEFAULT_NEON_PASSES: readonly NeonPass[] = [
  { widthMul: 9.0, alphaMul: 0.05 },
  { widthMul: 4.5, alphaMul: 0.1 },
  { widthMul: 2.0, alphaMul: 0.3 },
  { widthMul: 1.0, alphaMul: 1.0, core: true },
];

export type NeonStrokeOptions = {
  ctx: Ctx;
  path: PathFn;
  color: string;
  width: number;
  coreColor?: string;
  passes?: readonly NeonPass[];
  intensity?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
};

export const neonStroke = ({
  ctx,
  path,
  color,
  width,
  coreColor,
  passes = DEFAULT_NEON_PASSES,
  intensity = 1,
  lineCap = 'round',
  lineJoin = 'round',
}: NeonStrokeOptions): void => {
  if (intensity <= 0 || width <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = lineCap;
  ctx.lineJoin = lineJoin;

  for (const pass of passes) {
    const alpha = pass.alphaMul * intensity;
    if (alpha <= 0) continue;

    ctx.globalAlpha = Math.min(1, alpha);
    ctx.lineWidth = Math.max(0.1, width * pass.widthMul);
    ctx.strokeStyle = pass.core ? (coreColor ?? color) : color;
    ctx.filter = pass.blur ? `blur(${pass.blur}px)` : 'none';

    path(ctx);
    ctx.stroke();
  }

  ctx.restore();
};

/**
 * The same construction for a filled shape rather than a stroked path — a neon
 * disc, a glowing dot. Passes become concentric scaled fills instead of widths.
 *
 * `radius` is the core radius; each pass multiplies it.
 */
export const neonFill = ({
  ctx,
  cx,
  cy,
  radius,
  color,
  coreColor,
  passes = DEFAULT_NEON_PASSES,
  intensity = 1,
}: {
  ctx: Ctx;
  cx: number;
  cy: number;
  radius: number;
  color: string;
  coreColor?: string;
  passes?: readonly NeonPass[];
  intensity?: number;
}): void => {
  if (intensity <= 0 || radius <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const pass of passes) {
    const alpha = pass.alphaMul * intensity;
    if (alpha <= 0) continue;

    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = pass.core ? (coreColor ?? color) : color;
    ctx.filter = pass.blur ? `blur(${pass.blur}px)` : 'none';

    ctx.beginPath();
    ctx.arc(cx, cy, radius * pass.widthMul, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};
