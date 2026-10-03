// Palette and type for the terminal. All screens share it.
export const C = {
  bg: "#0E1A2E",
  bgDeep: "#0A1424",
  panel: "#102038",
  panelHi: "#132744",
  line: "rgba(120, 156, 214, 0.26)",
  grid: "rgba(110, 146, 206, 0.11)",
  gridStrong: "rgba(120, 156, 214, 0.2)",
  textDim: "#6E85AC",
  text: "#A9BCDD",
  textBright: "#DCE7FA",
  green: "#2FD0A0",
  red: "#FF4A5A",
  blue: "#4F9CFF",
  orange: "#FF7A3F",
  grey: "#8796B2",
  tagText: "#07111F",
};

export const SANS = "Inter";
export const MONO = "JetBrains Mono";
export const font = (size: number, weight = 500, family = SANS) =>
  `${weight} ${size}px "${family}"`;
export const mono = (size: number, weight = 500) => font(size, weight, MONO);

/** rgba() from a #RRGGBB colour. */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
