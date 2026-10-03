import { Painter } from "../draw/primitives";
import { C } from "../theme";

/** Screen base with a faint backlight falloff. */
export const drawScreenBase = (p: Painter, W: number, H: number, cx: number, cy: number) => {
  if (p.glow) return;
  const { ctx } = p;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
  g.addColorStop(0, "rgba(40, 70, 120, 0.08)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.3)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};
