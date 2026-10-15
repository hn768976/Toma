import { mulberry32 } from "../../lib/rand";

/** ~800 faint stars baked once (static, as in a tripod exposure). */
export const drawStars = (W: number, H: number, res: number, count = 800) => {
  const c = document.createElement("canvas");
  c.width = Math.round(W * res);
  c.height = Math.round(H * res);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(res, res);
  ctx.globalCompositeOperation = "lighter";
  const r = mulberry32(4242);
  for (let i = 0; i < count; i++) {
    const x = r() * W;
    const y = r() * H;
    const m = Math.pow(r(), 5);
    const rad = Math.max(1.6 / res, 2.2 + 3.2 * m);
    const a = 0.1 + 0.9 * m;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(235,240,255,${a})`);
    g.addColorStop(0.45, `rgba(235,240,255,${a * 0.35})`);
    g.addColorStop(1, "rgba(235,240,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
};
