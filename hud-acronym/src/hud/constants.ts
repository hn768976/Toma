/** Shared settings for every HUD Acronym composition (same seed, board, rings, camera). */
export const FPS = 30;
export const LOOP = 600; // 20 s seamless loop
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const SEED = 1110755849;

/** Phase of the loop in [0, 1). Frame 600 maps exactly onto frame 0. */
export const loopPhase = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;
/** fract(k * phase + offset) with integer k, computed in integers so it loops exactly. */
export const cyc = (frame: number, k: number, offset = 0) => {
  const f = ((frame % LOOP) + LOOP) % LOOP;
  const v = ((k * f) % LOOP) / LOOP + offset;
  return v - Math.floor(v);
};

/** sRGB hex -> linear RGB triple. */
export const lin = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return [c[0], c[1], c[2]];
};

export const COLORS = {
  core: lin("#D8FFFF"),
  glow: lin("#4FE0F0"),
  board: lin("#03131A"),
  traceBlue: lin("#2FA6E0"), // board traces lean a little bluer than the glow
};

/** World layout (units: inner ring radius = 1). */
export const LAYOUT = {
  innerR: 1,
  // Word ink width as a fraction of the inner ring's diameter.
  wordFrac: 0.6,
  wordFracShort: 0.45, // 1–2 letter words
  // Segment glyphs are drawn taller than DSEG's native proportions (tall, narrow display cells).
  wordStretchY: 1.45,
};
