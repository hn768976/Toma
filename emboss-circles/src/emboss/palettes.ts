export type Palette = {
  bg: [number, number, number];
  paper: [number, number, number];
  shadow: [number, number, number];
  warm: [number, number, number];
  line: [number, number, number];
  chan: [number, number, number];
  shadowGain: number;
  warmGain: number;
  lineGain: number;
};

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Version 1 — sampled from the reference: off-white paper, navy ink shadow,
// a warm cream fringe and a faint blush inside the grooves.
export const PAPER_WHITE: Palette = {
  bg: hex("#fefefe"),
  paper: hex("#ffffff"),
  shadow: hex("#2e3756"),
  warm: hex("#f3dcb8"),
  line: hex("#8c8a96"),
  chan: hex("#fbf6f6"),
  shadowGain: 1,
  warmGain: 1,
  lineGain: 1,
};

// Version 2 — "Midnight Copper": the same paper-cut relief re-lit as a night
// scene. Ink-blue paper, near-black shadows and a copper rim light.
export const MIDNIGHT_COPPER: Palette = {
  bg: hex("#121830"),
  paper: hex("#1a2243"),
  shadow: hex("#02030a"),
  warm: hex("#e79a5b"),
  line: hex("#d8925e"),
  chan: hex("#1a1734"),
  shadowGain: 1.15,
  warmGain: 0.95,
  lineGain: 1.1,
};
