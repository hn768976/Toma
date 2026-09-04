/** The two looks. Same geometry, same data, different surface. */

export type Theme = {
  readonly name: string;
  readonly background: string;
  readonly rule: string;
  readonly text: string;
  readonly up: string;
  readonly down: string;
  /** Brightness of the deepest quotes, relative to the foreground. */
  readonly depthFloor: number;
  readonly flashAlpha: number;
  /** Bloom on the white rates. 0 disables it. */
  readonly bloom: number;
  /** Film grain opacity. 0 disables it. */
  readonly grain: number;
  readonly vignette: boolean;
  /** Faint screen glow behind the type. 0 disables it. */
  readonly glow: number;
};

export const DARK: Theme = {
  name: "dark",
  background: "#04060a",
  rule: "#1a2430",
  text: "#f0f4f8",
  up: "#16c784",
  down: "#ea3943",
  depthFloor: 0.4,
  flashAlpha: 0.2,
  bloom: 1,
  grain: 0.02,
  vignette: true,
  glow: 1,
};

export const LIGHT: Theme = {
  name: "light",
  background: "#ffffff",
  rule: "#e4e7eb",
  text: "#14181d",
  // The same hues, darkened so they hold contrast against white.
  up: "#0f9d68",
  down: "#c9252f",
  // Higher than V1: on white, 40 % opacity all but erases the far rows,
  // where on black it reads as the intended dim texture.
  depthFloor: 0.55,
  flashAlpha: 0.16,
  // Glow on a light background reads as a rendering error.
  bloom: 0,
  grain: 0,
  vignette: false,
  glow: 0,
};
