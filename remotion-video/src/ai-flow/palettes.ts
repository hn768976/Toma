// Two looks for the same animation. "original" matches the reference
// (teal night sky, cyan in / violet-cyan-green out); "ember" is the
// alternate colour pass (warm amber in / magenta-coral-gold out on plum).

export type FlowPalette = {
  bgInner: string;
  bgOuter: string;
  // Incoming (left) streams pick randomly between these.
  left: [string, string];
  // Outgoing (right) streams are graded top -> middle -> bottom.
  rightTop: string;
  rightMid: string;
  rightBottom: string;
  head: string;
  thread: string;
  chipFill: string;
  chipBorder: string;
  chipGlow: string;
  chipText: string;
  ring: string;
};

export const PALETTES = {
  original: {
    bgInner: "#0b252b",
    bgOuter: "#03100f",
    left: ["#2fe0e6", "#1aa9c4"],
    rightTop: "#9a5cff",
    rightMid: "#3fb8e8",
    rightBottom: "#38e08a",
    head: "#e9fbff",
    thread: "#3cc7d6",
    chipFill: "#06191d",
    chipBorder: "#45e6f5",
    chipGlow: "#21c9e0",
    chipText: "#ffffff",
    ring: "#4fd6e6",
  },
  ember: {
    bgInner: "#2a1020",
    bgOuter: "#0b0408",
    left: ["#ffb347", "#ff7f3f"],
    rightTop: "#ff3d8b",
    rightMid: "#ff7a59",
    rightBottom: "#ffd166",
    head: "#fff4e3",
    thread: "#ff9a5c",
    chipFill: "#1c0812",
    chipBorder: "#ffae57",
    chipGlow: "#ff7a3d",
    chipText: "#fff7ee",
    ring: "#ffa26b",
  },
} satisfies Record<string, FlowPalette>;

export type PaletteName = keyof typeof PALETTES;

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const mixRgb = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const rgba = (c: [number, number, number], a: number) =>
  `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
