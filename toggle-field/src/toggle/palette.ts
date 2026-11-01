/** Colours sampled from the reference footage (k-means over the clip). */
export type TogglePalette = {
  background: string;
  tracks: readonly (readonly [string, number])[];
  knobs: readonly (readonly [string, number])[];
  accentTrack: string; // the rare "on" track colour (yellow in the reference)
  accentKnob: string; // hot knob colour (pink in the reference)
};

export const REFERENCE_PALETTE: TogglePalette = {
  background: "#762ed7",
  tracks: [
    ["#9a5390", 0.34], // dusty mauve
    ["#762ed7", 0.22], // base violet
    ["#7a2fc4", 0.16], // deep violet
    ["#8c2c98", 0.2], // plum
    ["#a1307f", 0.08], // magenta plum
  ],
  knobs: [
    ["#7b33dc", 0.42],
    ["#8c2c98", 0.26],
    ["#6f2cc0", 0.16],
    ["#9a5390", 0.06],
    ["#f8ac1f", 0.1],
  ],
  accentTrack: "#f8ac1f",
  accentKnob: "#dd318e",
};
