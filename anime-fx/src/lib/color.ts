export type RGB = [number, number, number];

export const hex = (h: string): RGB => {
  const s = h.replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
};

export const toHex = (c: RGB) =>
  "#" +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

export const mix = (a: string, b: string, t: number) => {
  const A = hex(a);
  const B = hex(b);
  return toHex([
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t,
  ]);
};

export const rgba = (h: string, a: number) => {
  const c = hex(h);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};
