export type Palette = {
  css: string;
  paintBackground: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  line: (alpha: number) => string;
  node: (alpha: number) => string;
  dust: (alpha: number) => string;
  lineWidth: number; // px at 1080p
  nodeRadius: number; // px at 1080p
  dustRadius: number; // px at 1080p
  lineFrontAlpha: number;
  lineBackAlpha: number;
  nodeBackAlpha: number;
  dustBackAlpha: number;
  glow: number; // shadow blur px at 1080p (0 = none)
  glowColor: string;
  dither: number; // ± LSB noise added to the background (0 = none)
  dustAlpha: number; // global dust opacity multiplier
  backBlur: number; // blur (px at 1080p) for elements behind the mid-plane
};

// Version 1 — matches the reference: pure white field, black dots,
// hairline grey wireframe.
const reference: Palette = {
  css: "#ffffff",
  paintBackground: (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  },
  line: (a) => `rgba(28,28,30,${a.toFixed(3)})`,
  node: (a) => `rgba(6,6,8,${a.toFixed(3)})`,
  dust: (a) => `rgba(10,10,12,${a.toFixed(3)})`,
  lineWidth: 1.4,
  nodeRadius: 5.4,
  dustRadius: 3.2,
  lineFrontAlpha: 0.55,
  lineBackAlpha: 0.2,
  nodeBackAlpha: 0.82,
  dustBackAlpha: 0.75,
  glow: 0,
  glowColor: "transparent",
  dither: 0,
  dustAlpha: 1,
  backBlur: 1.1,
};

// Version 2 — alternative palette: deep midnight-navy field with a
// luminous cyan network (same geometry, layout and motion).
const midnight: Palette = {
  css: "#050b1c",
  paintBackground: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.8, h * 0.46, 0, w * 0.8, h * 0.46, w * 0.95);
    g.addColorStop(0, "#12305a");
    g.addColorStop(0.45, "#0b1c3c");
    g.addColorStop(1, "#060d1d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  line: (a) => `rgba(110,214,255,${a.toFixed(3)})`,
  node: (a) => `rgba(205,248,255,${a.toFixed(3)})`,
  dust: (a) => `rgba(150,228,255,${a.toFixed(3)})`,
  lineWidth: 1.15,
  nodeRadius: 5.4,
  dustRadius: 3.2,
  lineFrontAlpha: 0.7,
  lineBackAlpha: 0.2,
  nodeBackAlpha: 0.55,
  dustBackAlpha: 0.45,
  glow: 7,
  glowColor: "rgba(80,200,255,0.9)",
  dither: 1.5,
  dustAlpha: 0.6,
  backBlur: 1.3,
};

export const PALETTES = { reference, midnight } as const;
