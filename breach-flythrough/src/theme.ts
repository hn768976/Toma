/**
 * The two colour treatments. Only the data and label colours change between
 * them: the padlocks stay red so the breached records never blend into the
 * data, warm palette or not.
 */

export type Palette = {
  /** Backdrop, and the faint lift toward the centre of frame. */
  background: string;
  backgroundLift: string;
  /** Hex tokens, brightest (near focus) through dimmest (deep layers). */
  dataBright: string;
  dataMid: string;
  dataDim: string;
  /** Category labels. */
  label: string;
  labelGlow: string;
  /** Breached records. */
  breached: string;
  /** The few records still secured. */
  secured: string;
};

export const CYAN: Palette = {
  background: "#02040a",
  backgroundLift: "#071628",
  dataBright: "#22d3ee",
  dataMid: "#2496c4",
  dataDim: "#1e6fa8",
  label: "#ffffff",
  labelGlow: "180, 220, 255",
  breached: "#e02033",
  secured: "#22c55e",
};

export const AMBER: Palette = {
  background: "#02040a",
  backgroundLift: "#1b1206",
  dataBright: "#f0a028",
  dataMid: "#c27c18",
  dataDim: "#8e5409",
  label: "#fff3e0",
  labelGlow: "255, 224, 176",
  breached: "#e02033",
  secured: "#22c55e",
};
