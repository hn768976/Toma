export type Rgb = readonly [number, number, number];

export type Palette = {
  readonly id: string;
  readonly background: Rgb;
  /** Line colour ramp, far -> mid -> near. */
  readonly far: Rgb;
  readonly mid: Rgb;
  readonly near: Rgb;
  /** Colour of the soft haze around the vanishing point. */
  readonly haze: Rgb;
};

const hex = (s: string): Rgb => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];

export const PALETTES: Record<string, Palette> = {
  red: {
    id: "red",
    background: hex("#050000"),
    far: hex("#8a0a0a"),
    mid: hex("#e01818"),
    near: hex("#ff8080"),
    haze: hex("#ff2a10"),
  },
  cyan: {
    id: "cyan",
    background: hex("#000508"),
    far: hex("#0a5a7a"),
    mid: hex("#22c8f0"),
    near: hex("#c0f8ff"),
    haze: hex("#18b0e8"),
  },
  magenta: {
    id: "magenta",
    background: hex("#060008"),
    far: hex("#6a0a7a"),
    mid: hex("#e022e0"),
    near: hex("#ffb0ff"),
    haze: hex("#d824e8"),
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where along the ramp the mid (signature) colour is reached. */
const MID_STOP = 0.78;

/**
 * Sample the far -> mid -> near ramp. `t` is 0 at the vanishing point and 1 at
 * the frame edge.
 *
 * Two deliberate shapes here. The far -> mid leg is gamma-biased so the corridor
 * reaches its signature colour early instead of spending most of its depth in
 * the near-black far stop, which reads as muddy. The mid -> near leg is left
 * late and linear so only the last couple of lines blow out toward white — the
 * reference stays saturated almost to the frame edge, and a corridor that goes
 * pink halfway up loses its depth.
 */
export const rampAt = (p: Palette, t: number): Rgb => {
  if (t <= MID_STOP) {
    const k = Math.pow(t / MID_STOP, 0.7);
    return [
      lerp(p.far[0], p.mid[0], k),
      lerp(p.far[1], p.mid[1], k),
      lerp(p.far[2], p.mid[2], k),
    ];
  }
  const k = (t - MID_STOP) / (1 - MID_STOP);
  return [
    lerp(p.mid[0], p.near[0], k),
    lerp(p.mid[1], p.near[1], k),
    lerp(p.mid[2], p.near[2], k),
  ];
};

export const css = (c: Rgb, alpha = 1): string =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;
