export type Rgb = readonly [number, number, number];

export const hexToRgb = (hex: string): Rgb => {
  const body = hex.replace('#', '');
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgba = (c: Rgb, a: number): string =>
  `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
