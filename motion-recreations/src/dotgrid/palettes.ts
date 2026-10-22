import type { DotGridPalette } from "./DotGrid";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Version 1: white background with aqua squares that deepen to teal as they
// brighten, sampled from the reference.
export const referencePalette: DotGridPalette = {
  background: "#fffeff",
  dotColor: (_x, v) => {
    const k = Math.min(1, v * 1.4);
    const r = Math.round(lerp(0, 14, k));
    const g = Math.round(lerp(200, 150, k));
    const b = Math.round(lerp(222, 182, k));
    return `rgba(${r}, ${g}, ${b}, ${Math.min(0.85, v * 1.05)})`;
  },
  glow: false,
};

// Version 2: "Midnight" — deep navy field, dots glow from electric cyan (left)
// to violet (right). Same grid, timing and twinkle as Version 1.
export const midnightPalette: DotGridPalette = {
  background: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, "#0d1736");
    g.addColorStop(1, "#03060f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  dotColor: (x, v) => {
    const r = Math.round(lerp(40, 168, x));
    const g = Math.round(lerp(226, 92, x));
    const b = Math.round(lerp(255, 255, x));
    const a = v <= 0 ? 0 : Math.min(1, 0.08 + v * 1.1);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },
  glow: true,
};
