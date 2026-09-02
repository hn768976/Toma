/**
 * Every colour in the piece lives here. No component may contain a hex
 * literal — they read from the THEME the `variant` prop selects.
 */

export type Theme = {
  /** Deep base fill behind everything. */
  backgroundDeep: string;
  /** Broad soft radial wash centred on the cloud. */
  backgroundWash: string;
  /** Dim circuit trace stroke. */
  circuitDim: string;
  /** Brighter circuit trace / pad stroke. */
  circuitBright: string;
  /** Cloud particle body colour. */
  cloudCyan: string;
  /** Cloud particle mid-tone. */
  cloudPale: string;
  /** Brightest cloud particles. */
  cloudWhite: string;
  /** Lit ring segment. */
  ringCyan: string;
  /** Unlit ring segment. */
  ringDim: string;
  /** Star field points. */
  starPale: string;
  /** Vignette ink. */
  vignette: string;
  /** Grain speckle (light lobe). */
  grainLight: string;
  /** Grain speckle (dark lobe). */
  grainDark: string;
};

export const THEMES = {
  blue: {
    backgroundDeep: "#060F2E",
    backgroundWash: "#12245C",
    circuitDim: "#16305C",
    circuitBright: "#2E5C9F",
    cloudCyan: "#4FC4F5",
    cloudPale: "#A8E4FF",
    cloudWhite: "#E8F8FF",
    ringCyan: "#5FD4F5",
    ringDim: "#1E4A6B",
    starPale: "#7FA8D4",
    vignette: "#01040F",
    grainLight: "#FFFFFF",
    grainDark: "#000000",
  },
} satisfies Record<string, Theme>;

export type Variant = keyof typeof THEMES;

export const getTheme = (variant: Variant): Theme => THEMES[variant] ?? THEMES.blue;
