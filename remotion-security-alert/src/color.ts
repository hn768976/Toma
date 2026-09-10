/** Tiny hex colour helpers. Mixing is done in JS rather than with CSS
 * `color-mix()` so the output is identical in the Studio and in every
 * render worker, whatever the browser build. */

const parse = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const toHex = (rgb: [number, number, number]): string =>
  `#${rgb.map((c) => clamp255(c).toString(16).padStart(2, "0")).join("")}`;

/** Linear mix of two hex colours; `t` of 0 returns `a`, 1 returns `b`. */
export const mix = (a: string, b: string, t: number): string => {
  const x = parse(a);
  const y = parse(b);
  const k = Math.max(0, Math.min(1, t));
  return toHex([
    x[0] + (y[0] - x[0]) * k,
    x[1] + (y[1] - x[1]) * k,
    x[2] + (y[2] - x[2]) * k,
  ]);
};

/** Hex colour as `rgba()` with an explicit alpha. */
export const alpha = (hex: string, a: number): string => {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
