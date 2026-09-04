export type Theme = {
  id: string;
  /** Near black ground the whole frame sits on. */
  bg: string;
  /** Corruption ramp, dim to hot. */
  deep: string;
  mid: string;
  hot: string;
  /** Stray fragments that survive the channel split as colour. */
  accents: string[];
  /**
   * The channel split pair. The two masks must partition RGB exactly so that
   * screening them back together with zero offset reproduces the original.
   */
  splitA: string;
  splitB: string;
  message: string;
  messageRule: string;
  flare: string;
  rollBar: string;
};

export const RED_THEME: Theme = {
  id: "red",
  bg: "#08050a",
  deep: "#a00c26",
  mid: "#e01030",
  hot: "#ff4055",
  accents: ["#7b2bff", "#22d3ee", "#ff8fa3", "#b81ba0"],
  splitA: "#ff0000",
  splitB: "#00ffff",
  message: "#ffffff",
  messageRule: "#e01030",
  flare: "#ffd8c4",
  rollBar: "#ff5a70",
};

export const GREEN_THEME: Theme = {
  id: "green",
  bg: "#02080a",
  deep: "#0d9c4c",
  mid: "#14c063",
  hot: "#22ff88",
  accents: ["#ff2ec4", "#0affd0", "#a8ff6a", "#00b3ff"],
  splitA: "#00ff00",
  splitB: "#ff00ff",
  message: "#dcffe9",
  messageRule: "#22ff88",
  flare: "#cfffe6",
  rollBar: "#22ff88",
};

const parseHex = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Blend two hex colours, t = 0 gives `from`. */
export const mixHex = (from: string, to: string, t: number): string => {
  const a = parseHex(from);
  const b = parseHex(to);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/**
 * Componentwise multiply by a channel mask. Used to pre-tint the DOM message
 * so the two split passes screen back to exactly `colour`.
 */
export const maskColor = (color: string, mask: string): string => {
  const c = parseHex(color);
  const m = parseHex(mask);
  return `rgb(${Math.round((c[0] * m[0]) / 255)}, ${Math.round((c[1] * m[1]) / 255)}, ${Math.round(
    (c[2] * m[2]) / 255,
  )})`;
};

/** Channel masked colour with an alpha, for the message passes. */
export const maskRgba = (color: string, mask: string, alpha: number): string => {
  const c = parseHex(color);
  const m = parseHex(mask);
  return `rgba(${Math.round((c[0] * m[0]) / 255)}, ${Math.round((c[1] * m[1]) / 255)}, ${Math.round(
    (c[2] * m[2]) / 255,
  )}, ${alpha})`;
};

/** Position on the corruption ramp: 0 = deep, 1 = hot. */
export const toneColor = (theme: Theme, tone: number): string =>
  tone < 0.5 ? mixHex(theme.deep, theme.mid, tone * 2) : mixHex(theme.mid, theme.hot, (tone - 0.5) * 2);
