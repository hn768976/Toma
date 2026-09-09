// The three versions. Same particle engine, three luxury registers:
// gold (awards / festive), silver-platinum (cool premium) and rose gold
// (beauty / wedding), which the other two do not reach.

export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const value = parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

export const rgbaString = (c: Rgb, alpha: number): string =>
  `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;

export type Palette = {
  id: string;
  // Particle ramp, brightest first. Sampled by a particle's faked depth.
  ramp: [string, string, string];
  // Near-white core of arc highlights and sparkles.
  highlight: string;
  bokeh: string;
  ringGlow: string;
  backgroundInner: string; // deep tone behind the ring
  backgroundOuter: string; // near-black at the corners
};

export const PALETTES: Record<string, Palette> = {
  gold: {
    id: "gold",
    ramp: ["#fff2c8", "#ffd058", "#a87008"],
    highlight: "#fffbe8",
    bokeh: "#b87d18",
    ringGlow: "#c89024",
    backgroundInner: "#1a0e02",
    backgroundOuter: "#050200",
  },
  silver: {
    id: "silver",
    ramp: ["#ffffff", "#dce4ec", "#78828c"],
    highlight: "#ffffff",
    bokeh: "#8494a4",
    ringGlow: "#93a2b0",
    backgroundInner: "#0c1014",
    backgroundOuter: "#020304",
  },
  roseGold: {
    id: "roseGold",
    ramp: ["#ffe0d0", "#e8a888", "#a05840"],
    highlight: "#fff2ea",
    bokeh: "#b0705c",
    ringGlow: "#c0806a",
    backgroundInner: "#1a0a08",
    backgroundOuter: "#050202",
  },
};

// Samples the three-stop ramp; t = 0 is the brightest stop.
export const sampleRamp = (palette: Palette, t: number): Rgb => {
  const stops = palette.ramp.map(hexToRgb);
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped < 0.5) {
    return mixRgb(stops[0], stops[1], clamped * 2);
  }
  return mixRgb(stops[1], stops[2], (clamped - 0.5) * 2);
};
