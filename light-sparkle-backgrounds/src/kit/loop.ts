// Everything loops over LOOP frames. All motion uses whole cycles of LOOP.
export const LOOP = 600;
export const FPS = 30;
export const DESIGN_W = 3840;
export const DESIGN_H = 2160;
export const TAU = Math.PI * 2;

// Periods that divide 600 frames, expressed as cycles per loop.
export const CYCLES = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const;

export const phaseOf = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;

export const mod = (a: number, n: number) => ((a % n) + n) % n;

// Smooth periodic pulse in [0,1]: k whole cycles per loop, seeded phase, sharpness p.
export const pulse = (phase: number, k: number, phi: number, p: number) =>
  Math.pow(0.5 + 0.5 * Math.cos(TAU * k * phase + phi), p);

export type Glint = { target: number; start: number; dur: number; gain: number };

// Glint envelope: quick rise, softer decay, wrapped around the loop so frame 600 == frame 0.
export const glintEnvelope = (frame: number, g: Glint) => {
  const d = mod(frame - g.start, LOOP);
  if (d >= g.dur) return 0;
  const x = d / g.dur;
  const rise = 0.22;
  const e = x < rise ? x / rise : 1 - (x - rise) / (1 - rise);
  return e * e * (3 - 2 * e);
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const hexToNum = (hex: string) => parseInt(hex.replace("#", ""), 16);
