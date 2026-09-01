const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

const parse = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

/**
 * Blend two palette colours. Used by the colour bar so its greys are derived
 * from the variant palette rather than being new hard-coded values.
 */
export const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = clamp255(ar + (br - ar) * t);
  const g = clamp255(ag + (bg - ag) * t);
  const bl = clamp255(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
};
