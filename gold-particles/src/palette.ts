export type Rgb = readonly [number, number, number];

const hexToRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export type Palette = {
  // Particle colour ramp, brightest first.
  readonly particleRamp: readonly Rgb[];
  // Colour a sparkle flash blows out to.
  readonly sparkle: Rgb;
  // Deepest background, at the top corners.
  readonly base: Rgb;
  // Glow layers, outermost (broad wash) first, hot core last.
  readonly glow: readonly Rgb[];
  readonly glowAlpha: readonly number[];
};

const buildRamp = (stops: readonly string[], steps: number): Rgb[] => {
  const rgb = stops.map(hexToRgb);
  const out: Rgb[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * (rgb.length - 1);
    const lo = Math.min(rgb.length - 1, Math.floor(t));
    const hi = Math.min(rgb.length - 1, lo + 1);
    const f = t - lo;
    out.push([
      Math.round(rgb[lo][0] + (rgb[hi][0] - rgb[lo][0]) * f),
      Math.round(rgb[lo][1] + (rgb[hi][1] - rgb[lo][1]) * f),
      Math.round(rgb[lo][2] + (rgb[hi][2] - rgb[lo][2]) * f),
    ]);
  }
  return out;
};

// Five colour buckets per palette: bright particles sit at the pale end
// of the ramp, dim ones at the deep end, so brightness and hue move
// together the way real glitter does.
export const COLOR_BUCKETS = 5;

export const PALETTES = {
  gold: {
    particleRamp: buildRamp(["#fff0c0", "#ffd870", "#c08810"], COLOR_BUCKETS),
    sparkle: hexToRgb("#fffdf2"),
    base: hexToRgb("#060302"),
    glow: [hexToRgb("#7a3c05"), hexToRgb("#c06a12"), hexToRgb("#f0a020")],
    glowAlpha: [0.7, 0.26, 0.62],
  },
  silver: {
    particleRamp: buildRamp(["#ffffff", "#dce4ec", "#7a848e"], COLOR_BUCKETS),
    sparkle: hexToRgb("#ffffff"),
    base: hexToRgb("#04060a"),
    glow: [hexToRgb("#2a3540"), hexToRgb("#7d8c9c"), hexToRgb("#c8d4e0")],
    glowAlpha: [0.7, 0.24, 0.58],
  },
} as const satisfies Record<string, Palette>;

export type VariantName = keyof typeof PALETTES;

export const rgba = (color: Rgb, alpha: number) =>
  `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
