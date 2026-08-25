const hex = (h: string) => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const;
};

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const toHex = (r: number, g: number, b: number) =>
  '#' +
  [r, g, b].map((n) => clamp255(n).toString(16).padStart(2, '0')).join('');

/** Mix a colour toward white. amount 0 = unchanged, 1 = white. */
export const lift = (color: string, amount: number) => {
  const [r, g, b] = hex(color);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
};

/** Mix a colour toward black. */
export const sink = (color: string, amount: number) => {
  const [r, g, b] = hex(color);
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
};

/** Linear blend between two hex colours. */
export const mix = (a: string, b: string, t: number) => {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
};

export const rgba = (color: string, alpha: number) => {
  const [r, g, b] = hex(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
