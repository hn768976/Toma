/** Horizontal drift amplitude per layer, in 4K pixels. Max is the ±14px spec. */
export const DRIFT = {
  far: 4,
  fogBack: 5,
  mid: 7.5,
  fogFront: 9,
  near: 11,
  ground: 11,
  foreground: 14,
  particles: 10,
} as const;
