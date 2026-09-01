/**
 * vignettePass.ts — darken (or lighten) the frame edges.
 *
 * WHAT IT DOES
 *   Fills the canvas with a radial gradient that is transparent in the
 *   middle and reaches `color` at the corners.
 *
 * WHAT IT IS FOR
 *   Holding the eye in the middle of the frame. Almost every dark
 *   composition needs one: without it, a bright element near an edge
 *   drags attention off-screen, and the frame border itself becomes the
 *   most contrasty line in the shot.
 *
 * PARAMETERS
 *   ctx          destination 2D context
 *   width,       composition size in px
 *   height
 *   color        REQUIRED Color. Usually a translucent near-black, e.g.
 *                "rgba(2, 3, 8, 0.55)". No default: a vignette hard-coded
 *                to black fights every palette that is not black-grounded,
 *                and the alpha in this string is your strength control.
 *   innerStop    0..1 of the radius where darkening begins. Default 0.45
 *                — the middle 45% stays completely untouched.
 *   outerStop    0..1 where `color` reaches full strength. Default 1.
 *   shape        "ellipse" follows the frame's aspect (default, and what
 *                you want for 16:9); "circle" is uniform in all
 *                directions and leaves the left and right edges lighter.
 *   center       { x, y } in px. Defaults to the frame centre. Offset it
 *                to bias the eye toward an off-centre subject.
 *   blendMode    Default "source-over" (paints on top). "multiply"
 *                deepens existing colour instead of veiling it, which
 *                keeps saturation better on bright footage.
 *
 * GOTCHA
 *   Apply this BEFORE grain and after everything else. A vignette drawn
 *   over grain flattens the grain it covers, and the corners then look
 *   cleaner than the centre — precisely backwards from real optics.
 *
 * USAGE
 *   vignettePass({ ctx, width, height, color: "rgba(2,3,8,0.55)" });
 */

import type { Color, Point } from "../types";

export type VignettePassOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  color: Color;
  innerStop?: number;
  outerStop?: number;
  shape?: "ellipse" | "circle";
  center?: Point;
  blendMode?: GlobalCompositeOperation;
};

export const vignettePass = ({
  ctx,
  width,
  height,
  color,
  innerStop = 0.45,
  outerStop = 1,
  shape = "ellipse",
  center,
  blendMode = "source-over",
}: VignettePassOptions): void => {
  const cx = center?.x ?? width / 2;
  const cy = center?.y ?? height / 2;

  // Radius that reaches the furthest corner, so the gradient is complete
  // everywhere in frame rather than stopping short on the diagonals.
  const radius = Math.hypot(
    Math.max(cx, width - cx),
    Math.max(cy, height - cy),
  );

  const previousOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = blendMode;
  ctx.save();

  if (shape === "ellipse") {
    // A circular gradient squashed to the frame aspect. Scaling the
    // context is the only way to get an elliptical radial gradient in
    // canvas 2D, which has no native equivalent of CSS's
    // `radial-gradient(ellipse ...)`.
    const scaleY = height / width;
    ctx.translate(cx, cy);
    ctx.scale(1, scaleY);
    ctx.translate(-cx, -cy);
  }

  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    radius * Math.max(0, Math.min(1, innerStop)),
    cx,
    cy,
    radius * Math.max(0.0001, outerStop),
  );
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(1, color);

  ctx.fillStyle = gradient;
  // Overfill: the scale transform shrinks the painted area vertically.
  ctx.fillRect(-width, -height, width * 3, height * 3);

  ctx.restore();
  ctx.globalCompositeOperation = previousOp;
};
