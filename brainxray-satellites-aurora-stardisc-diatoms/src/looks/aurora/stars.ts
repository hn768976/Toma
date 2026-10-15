import { mulberry32, range } from "../../lib/rand";

/** Static star field (tripod exposure): magnitudes, colours, a few bright stars with halos. */
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
  const palette = [
    [225, 232, 255],
    [245, 248, 255],
    [255, 255, 255],
    [255, 246, 230],
    [255, 228, 200],
  ];
  const n = count * 2;
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * H * 0.92;
    const m = Math.pow(r(), 7);
    const col = palette[Math.floor(r() * palette.length)];
    const rad = Math.max(1.1 / res, 1.1 + 2.0 * m);
    const a = (0.06 + 0.94 * m) * range(r, 0.7, 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
    g.addColorStop(0.45, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.3})`);
    g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    if (m > 0.75) {
      // soft bloom around the brightest stars
      const R = rad * 5;
      const h = ctx.createRadialGradient(x, y, 0, x, y, R);
      h.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.12 * m})`);
      h.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      ctx.fillStyle = h;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
  }
  return c;
};
