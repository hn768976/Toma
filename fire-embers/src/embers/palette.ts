/**
 * Colour by temperature, not by chance.
 *
 * Each ember carries a heat value in [0, 1] that falls as it rises, so the
 * top of the frame reads redder than the bottom. The ramp below is what turns
 * a particle field into fire rather than glowing confetti.
 */

export type Rgb = { r: number; g: number; b: number };

export type Palette = {
  /** Heat ramp, coldest first. Sampled linearly between adjacent stops. */
  readonly stops: readonly Rgb[];
  /** Tint of the haze masses sitting below the embers. */
  readonly haze: Rgb;
};

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });

/** V1/V3 — the reference match: fire, campfire, forge, autumn. */
export const WARM: Palette = {
  stops: [
    rgb(0x5a, 0x18, 0x08), // coldest — nearly extinguished
    rgb(0xc0, 0x30, 0x10), // cooling — deep red
    rgb(0xff, 0x98, 0x20), // mid — orange
    rgb(0xff, 0xf4, 0xc0), // hottest — white-yellow core
  ],
  haze: rgb(0x93, 0x30, 0x0c),
};

/** V2 — magic, frost sparks, fantasy. Same build, a different brief. */
export const COOL: Palette = {
  stops: [
    rgb(0x16, 0x34, 0x70), // coldest — deep indigo
    rgb(0x2c, 0x76, 0xe4), // cooling — blue
    rgb(0x7f, 0xcc, 0xff), // mid — cyan-blue
    rgb(0xf4, 0xfc, 0xff), // hottest — white-blue core
  ],
  haze: rgb(0x28, 0x58, 0xac),
};

/** Sample the heat ramp. `heat` is clamped to [0, 1]. */
export const sampleHeat = (palette: Palette, heat: number): Rgb => {
  const { stops } = palette;
  const t = Math.min(1, Math.max(0, heat)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i;
  const a = stops[i];
  const b = stops[i + 1];
  return {
    r: a.r + (b.r - a.r) * f,
    g: a.g + (b.g - a.g) * f,
    b: a.b + (b.b - a.b) * f,
  };
};

export const cssRgb = (c: Rgb, alpha = 1): string =>
  `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${alpha})`;

/**
 * Heat is quantised into buckets so sprites can be pre-rendered per colour
 * rather than tinted per particle. 16 steps is far finer than the eye can
 * resolve on objects a few pixels across.
 */
export const HEAT_BUCKETS = 16;

export const heatBucket = (heat: number): number =>
  Math.min(
    HEAT_BUCKETS - 1,
    Math.max(0, Math.round(heat * (HEAT_BUCKETS - 1))),
  );

export const bucketHeat = (bucket: number): number =>
  bucket / (HEAT_BUCKETS - 1);
