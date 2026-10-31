/**
 * Intensity -> colour ramps. GOLD is sampled from the reference footage
 * (pixel colours bucketed by luminance); VIOLET is the Version 2 alternative
 * palette with the same luminance structure.
 */
export type Ramp = { stops: number[]; colors: [number, number, number][] };
export type PaletteName = "gold" | "violet";

export const PALETTES: Record<PaletteName, Ramp> = {
  gold: {
    stops: [0, 0.07, 0.18, 0.3, 0.43, 0.56, 0.69, 0.81, 0.91, 1],
    colors: [
      [0, 0, 0],
      [38, 6, 0],
      [94, 28, 7],
      [127, 65, 10],
      [157, 104, 15],
      [189, 142, 24],
      [220, 177, 39],
      [249, 215, 68],
      [254, 244, 122],
      [255, 254, 196],
    ],
  },
  violet: {
    stops: [0, 0.07, 0.18, 0.3, 0.43, 0.56, 0.69, 0.81, 0.91, 1],
    colors: [
      [0, 0, 0],
      [22, 0, 38],
      [62, 6, 98],
      [98, 16, 146],
      [138, 32, 186],
      [178, 58, 218],
      [214, 98, 238],
      [244, 156, 250],
      [252, 200, 255],
      [255, 238, 255],
    ],
  },
};

const sample = (ramp: Ramp, x: number) => {
  const { stops, colors } = ramp;
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i]) {
      const a = (x - stops[i - 1]) / (stops[i] - stops[i - 1]);
      return colors[i - 1].map((c, k) => c + (colors[i][k] - c) * a);
    }
  }
  return colors[colors.length - 1];
};

/** Evenly spaced lookup tables for SVG feComponentTransfer (type="table"). */
export const rampTable = (ramp: Ramp, n = 64) => {
  const r: string[] = [];
  const g: string[] = [];
  const b: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = sample(ramp, i / (n - 1));
    r.push((c[0] / 255).toFixed(4));
    g.push((c[1] / 255).toFixed(4));
    b.push((c[2] / 255).toFixed(4));
  }
  return { r: r.join(" "), g: g.join(" "), b: b.join(" ") };
};
