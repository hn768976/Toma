/** Colour ramps, shared by the nebulae, the orb and the vortex. */

export type RGB = [number, number, number];
export type Stop = { t: number; c: RGB };

export const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Samples a list of colour stops (sorted by `t`) at position `t` in [0,1]. */
export const ramp = (stops: Stop[], t: number): RGB => {
  if (t <= stops[0].t) return stops[0].c;
  const last = stops[stops.length - 1];
  if (t >= last.t) return last.c;
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i];
    if (t <= b.t) {
      const a = stops[i - 1];
      const k = (t - a.t) / (b.t - a.t);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * k,
        a.c[1] + (b.c[1] - a.c[1]) * k,
        a.c[2] + (b.c[2] - a.c[2]) * k,
      ];
    }
  }
  return last.c;
};

export const rgba = (c: RGB, a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

/** Composition palettes, straight from the brief. */
export const PALETTE = {
  violet: hex('#7a4ae8'),
  magenta: hex('#c026d3'),
  deepViolet: hex('#5b21b6'),
  cyan: hex('#22d3ee'),
  indigo: hex('#4a4ae8'),
  amber: hex('#ffb765'),
  chakra: {
    root: hex('#ff2d2d'),
    sacral: hex('#ff8a1f'),
    solar: hex('#ffd21f'),
    heart: hex('#2ee06a'),
    throat: hex('#22d3ee'),
    brow: hex('#4a4ae8'),
    crown: hex('#c026d3'),
  },
} as const;
