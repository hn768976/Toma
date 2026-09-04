/** Parses #rrggbb into [r, g, b]. */
export const parseHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Shifts every channel by `delta` levels, clamped to 0-255. */
export const shift = (hex: string, delta: number): string => {
  const c = parseHex(hex).map((v) =>
    Math.max(0, Math.min(255, Math.round(v + delta))),
  );
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};
