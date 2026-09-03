/**
 * Colour utilities for canvas drawing.
 *
 * Palettes are authored as hex strings (one place, one source of truth);
 * canvas work needs `rgba()` so alpha can vary per pass. `rgba` converts
 * without allocating a parser per call site.
 */
const parseHex = (hex: string): [number, number, number] => {
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

/** `rgba("#7FD4FF", 0.4)` -> `"rgba(127, 212, 255, 0.4)"`. */
export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Linear mix of two hex colours, returned as an `rgba()` string. */
export const mixHex = (a: string, b: string, t: number, alpha = 1): string => {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgba(${m(ar, br)}, ${m(ag, bg)}, ${m(ab, bb)}, ${alpha})`;
};
