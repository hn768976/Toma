// ─────────────────────────────────────────────────────────────────────────────
// PALETTES — one row per colour version.
//
// Adding a row here registers two new compositions automatically
// (CubeCluster-<Name> and CubeAssembly-<Name>); layouts and motion are shared,
// only these colours change. See README → "How to add a palette".
// ─────────────────────────────────────────────────────────────────────────────

export type Palette = {
  /** Name used in composition ids / file names. Letters and digits only. */
  name: string;
  /** Glowing cube tints, from the whitest core tone to the most saturated. */
  glow: [string, string, string];
  /** Frosted (milky) cube tint. */
  frosted: string;
  /** Clear-glass edge / reflection tint. */
  glass: string;
  /** Dark glossy cube colour. */
  dark: string;
  /** A few accent glowing cubes. */
  accent: string;
  /** Look 2 only: deep floor colour, background top colour, haze/horizon colour. */
  floor: string;
  sky: string;
  haze: string;
};

export const PALETTES: Palette[] = [
  // name      glow: [core-white,  mid,        saturated]   frosted    glass      dark       accent     floor      sky        haze
  { name: "Green",  glow: ["#e8fff2", "#6dffbe", "#9cff3d"], frosted: "#b4f2cf", glass: "#9dffd0", dark: "#032417", accent: "#e4ff2e", floor: "#03170f", sky: "#010c07", haze: "#145238" },
  { name: "Violet", glow: ["#f4ecff", "#c77bff", "#ff6fd8"], frosted: "#d8c6ff", glass: "#d6b8ff", dark: "#0f0738", accent: "#3fe3ff", floor: "#0d0726", sky: "#05020f", haze: "#3a2276" },
  { name: "Blue",   glow: ["#eef8ff", "#4fc0ff", "#86d3ff"], frosted: "#bfdfff", glass: "#a8d8ff", dark: "#030f2c", accent: "#b39dff", floor: "#041133", sky: "#010612", haze: "#1a4a9a" },
];

export const paletteByName = (name: string): Palette => {
  const p = PALETTES.find((x) => x.name === name);
  if (!p) throw new Error(`Unknown palette ${name}`);
  return p;
};
