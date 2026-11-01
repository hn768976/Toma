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
  ground: "#181d43",
  stripe: "#353c72",
  bar: "#7076c4",
  wire: "#d24a63",
  glow: "#ffd23a",
  cap: "#ffb43a",
  ambientSky: "#b4b8e6",
  ambientGround: "#2a1f3d",
  clear: "#121634",
};

/**
 * Version 2 – complementary "teal & ember" palette: deep teal ground,
 * warm amber bars, aqua wires and icy cyan light pulses.
 */
export const emberTealPalette: NeonPalette = {
  ground: "#06282c",
  stripe: "#0f4247",
  bar: "#e3793a",
  wire: "#22c7b8",
  glow: "#8ff4ff",
  cap: "#c8fbff",
  ambientSky: "#ffd1a6",
  ambientGround: "#08313a",
  clear: "#05222a",
};
