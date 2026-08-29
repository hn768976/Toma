// Palette helpers. The hex strings themselves only ever come from VARIANTS.

const parse = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

export const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
