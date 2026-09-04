/**
 * Colour ramps. Values are plain sRGB — the renderer is configured with no tone
 * mapping and a linear output colour space, so what the shader writes is what
 * lands in the frame and additive blending happens in the same space the ramp
 * was authored in.
 */

export type Ramp = {
  background: string;
  /** Ordered stops: [position 0..1, r, g, b] with channels in 0..1. */
  stops: [number, number, number, number][];
};

const hex = (h: string): [number, number, number] => {
  const v = parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

/**
 * The ramp stops at the *bright* colour, not at white. The hottest filaments
 * reach white-blue by clipping — their intensity carries them past 1.0 and the
 * blue channel saturates first — which is what leaves a coloured line with a
 * white core rather than a flat white one.
 */
const ramp = (
  background: string,
  colours: [number, string][],
): Ramp => ({
  background,
  stops: colours.map(([at, c]) => {
    const [r, g, b] = hex(c);
    return [at, r, g, b] as [number, number, number, number];
  }),
});

export const PALETTES = {
  blue: ramp("#01040c", [
    [0, "#0d2a6b"],
    [0.5, "#1e6fd9"],
    [1, "#7ab8ff"],
  ]),
  emerald: ramp("#010c08", [
    [0, "#0a3a2a"],
    [0.5, "#12a878"],
    [1, "#7affd0"],
  ]),
} as const;

export type PaletteName = keyof typeof PALETTES;

/** Flattened ramp lookup table, so the hot loop does no array-of-array work. */
export const buildRampLut = (r: Ramp, size = 256): Float32Array => {
  const lut = new Float32Array(size * 3);
  for (let i = 0; i < size; i++) {
    const p = i / (size - 1);
    let s = 0;
    while (s < r.stops.length - 2 && r.stops[s + 1][0] < p) s++;
    const a = r.stops[s];
    const b = r.stops[s + 1];
    const t = (p - a[0]) / (b[0] - a[0]);
    lut[i * 3] = a[1] + (b[1] - a[1]) * t;
    lut[i * 3 + 1] = a[2] + (b[2] - a[2]) * t;
    lut[i * 3 + 2] = a[3] + (b[3] - a[3]) * t;
  }
  return lut;
};
