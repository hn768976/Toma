export type RGB = [number, number, number];

export const rgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

export const rgba = (c: RGB, a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** Pre-baked alpha ramp so per-particle fills never build strings per frame. */
export const ramp = (hex: string, steps: number): string[] => {
  const c = rgb(hex);
  const out: string[] = [];
  for (let i = 0; i < steps; i++) out.push(rgba(c, (i + 1) / steps));
  return out;
};

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
