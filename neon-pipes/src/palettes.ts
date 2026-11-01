export type NeonPalette = {
  /** Ground base colour. */
  ground: string;
  /** Thin diagonal stripes printed on the ground. */
  stripe: string;
  /** Thick rounded structural bars. */
  bar: string;
  /** Thin wire tubes that run around the bars. */
  wire: string;
  /** Emissive light pulses that race along the wires (linear HDR multiplier applied). */
  glow: string;
  /** Small end caps on the wire drops. */
  cap: string;
  /** Sky / hemisphere tint used for ambient fill. */
  ambientSky: string;
  ambientGround: string;
  /** Background clear colour (visible only past the ground horizon). */
  clear: string;
};

/** Version 1 – matches the reference: navy ground, periwinkle bars, coral-red wires, warm yellow light. */
export const referencePalette: NeonPalette = {
  ground: "#292b47",
  stripe: "#47496a",
  bar: "#7076c4",
  wire: "#c4587f",
  glow: "#fae070",
  cap: "#e8c25a",
  ambientSky: "#c4c6e0",
  ambientGround: "#2a1f3d",
  clear: "#121634",
};

/**
 * Version 2 – complementary "teal & ember" palette: deep teal ground,
 * warm amber bars, aqua wires and warm-white light pulses.
 */
export const emberTealPalette: NeonPalette = {
  ground: "#06282c",
  stripe: "#0f4247",
  bar: "#e3793a",
  wire: "#22c7b8",
  glow: "#fff1c9",
  cap: "#ffe7b0",
  ambientSky: "#ffd1a6",
  ambientGround: "#08313a",
  clear: "#05222a",
};
