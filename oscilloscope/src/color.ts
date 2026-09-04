/** #rrggbb -> rgba() string. Keeps the palette readable as plain hex. */
export const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
