// Colour helpers. Scenes are lit and blended in linear light; the final
// pass converts to sRGB, so hex values round-trip exactly.

export const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};

export const hexToLinear = (hex: string): [number, number, number] =>
  hexToRgb(hex).map(srgbToLinear) as [number, number, number];

/** GLSL vec3 literal of a hex colour in linear light. */
export const glslLinear = (hex: string) => {
  const [r, g, b] = hexToLinear(hex);
  return `vec3(${r.toFixed(9)}, ${g.toFixed(9)}, ${b.toFixed(9)})`;
};
