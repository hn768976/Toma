/**
 * The two looks this piece ships in.
 *
 * `dark` reproduces the reference: near-black navy, deep royal-blue button,
 * additive neon bloom on the circuit traces.
 *
 * `light` is the daylight counterpart: near-white background, light-blue
 * button, and traces that read as dark ink on light paper — so the bloom
 * has to become a soft *shadow* instead of an additive glow. That single
 * difference is what `glowBlend` / `bloomOpacity` exist for.
 */

export type Theme = {
  /** Background radial gradient, centre -> edge. */
  bgInner: string;
  bgOuter: string;
  /** Soft pool of light the button sits in. */
  ambient: string;
  ambientOpacity: number;

  /** Circuit traces, by brightness tier. */
  traceDim: string;
  traceMid: string;
  traceBright: string;
  /** The travelling pulse that runs along a trace. */
  tracePulse: string;
  /** Opacity of each tier's base stroke. */
  traceDimOpacity: number;
  traceMidOpacity: number;
  traceBrightOpacity: number;
  /** How hard the wide "halo" strokes under each trace are drawn. */
  haloOpacity: number;
  /** Separate blurred bloom pass. */
  bloomOpacity: number;
  glowBlend: "screen" | "multiply";
  /** Small square solder pads. */
  padColor: string;

  /** Button. */
  ringColor: string;
  ringGlow: string;
  bodyCore: string;
  bodyMid: string;
  bodyEdge: string;
  bodyShadow: string;
  hairline: string;
  label: string;
  labelShadow: string;

  cursorFill: string;
  cursorStroke: string;

  /** Very faint grain so large flat areas do not band. */
  grainOpacity: number;
};

export const DARK_THEME: Theme = {
  bgInner: "#00042f",
  bgOuter: "#00011a",
  ambient: "#0a389c",
  ambientOpacity: 0.26,

  traceDim: "#0f2e6e",
  traceMid: "#2454bd",
  traceBright: "#4a83e8",
  tracePulse: "#8fbcf8",
  traceDimOpacity: 0.56,
  traceMidOpacity: 0.74,
  traceBrightOpacity: 0.95,
  haloOpacity: 0.12,
  bloomOpacity: 0.36,
  glowBlend: "screen",
  padColor: "#4b86e6",

  ringColor: "#0a49ff",
  ringGlow: "#1560f0",
  bodyCore: "#12a2ff",
  bodyMid: "#0072ff",
  bodyEdge: "#0043e8",
  bodyShadow: "rgba(2, 18, 72, 0.85)",
  hairline: "rgba(226, 244, 255, 0.92)",
  label: "#ffffff",
  labelShadow: "rgba(0, 26, 96, 0.75)",

  cursorFill: "#ffffff",
  cursorStroke: "rgba(4, 12, 40, 0.65)",

  grainOpacity: 0.016,
};

export const LIGHT_THEME: Theme = {
  bgInner: "#ffffff",
  bgOuter: "#dae5f8",
  ambient: "#8cc0ff",
  ambientOpacity: 0.3,

  traceDim: "#b3c9ec",
  traceMid: "#6f9be0",
  traceBright: "#2f6fe0",
  tracePulse: "#0b49b4",
  traceDimOpacity: 0.55,
  traceMidOpacity: 0.78,
  traceBrightOpacity: 0.95,
  haloOpacity: 0.07,
  bloomOpacity: 0.22,
  glowBlend: "multiply",
  padColor: "#3f7ce0",

  ringColor: "#3aa7f0",
  ringGlow: "#79c6ff",
  bodyCore: "#7ccdfb",
  bodyMid: "#33a6ef",
  bodyEdge: "#1183d8",
  bodyShadow: "rgba(30, 88, 148, 0.4)",
  hairline: "rgba(255, 255, 255, 0.95)",
  label: "#ffffff",
  labelShadow: "rgba(6, 52, 98, 0.6)",

  cursorFill: "#16264a",
  cursorStroke: "rgba(255, 255, 255, 0.85)",

  grainOpacity: 0.02,
};

export const THEMES = { dark: DARK_THEME, light: LIGHT_THEME } as const;
export type ThemeName = keyof typeof THEMES;
