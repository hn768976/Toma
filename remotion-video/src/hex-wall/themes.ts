/**
 * The two looks: the monochrome studio white of the reference, and the same
 * set dressed in tinted blue ceramic.
 */

export type HexWallTheme = {
  /** Colour of the hexagon prisms. */
  readonly tile: string;
  /** Colour of the flat panel sitting behind the grid. */
  readonly backdrop: string;
  /** Clear colour of the scene. */
  readonly background: string;
  readonly keyLight: { readonly color: string; readonly intensity: number };
  readonly fillLight: { readonly color: string; readonly intensity: number };
  readonly rimLight: { readonly color: string; readonly intensity: number };
  readonly ambient: { readonly color: string; readonly intensity: number };
  readonly hemisphere: {
    readonly sky: string;
    readonly ground: string;
    readonly intensity: number;
  };
  readonly roughness: number;
  /** Soft studio glow painted over the render, mimicking a large soft box. */
  readonly glow: string;
  readonly vignette: string;
  readonly exposure: number;
};

export const HEX_WALL_THEMES = {
  mono: {
    tile: "#eef0f3",
    backdrop: "#eef0f3",
    background: "#dcdee2",
    keyLight: { color: "#ffffff", intensity: 2.8 },
    fillLight: { color: "#f4f6fa", intensity: 0.95 },
    rimLight: { color: "#ffffff", intensity: 0.35 },
    ambient: { color: "#eef1f6", intensity: 1.1 },
    hemisphere: { sky: "#ffffff", ground: "#c4c9d0", intensity: 0.75 },
    roughness: 0.62,
    glow: "rgba(255,255,255,0.30)",
    vignette: "rgba(120,126,136,0.16)",
    exposure: 1,
  },
  blue: {
    tile: "#ccdcf3",
    backdrop: "#ccdcf3",
    background: "#b2c7e6",
    keyLight: { color: "#ffffff", intensity: 2.85 },
    fillLight: { color: "#dbe8fb", intensity: 0.95 },
    rimLight: { color: "#eaf3ff", intensity: 0.38 },
    ambient: { color: "#d8e6fb", intensity: 1.1 },
    hemisphere: { sky: "#f2f8ff", ground: "#8ba5c9", intensity: 0.75 },
    roughness: 0.6,
    glow: "rgba(238,247,255,0.32)",
    vignette: "rgba(46,74,116,0.18)",
    exposure: 1,
  },
} as const satisfies Record<string, HexWallTheme>;

export type HexWallThemeName = keyof typeof HEX_WALL_THEMES;
