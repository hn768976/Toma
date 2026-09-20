// One palette per reference clip. Everything colour-related in the 3D scene
// and the SVG overlay reads from here, so a new colourway is a new entry.
export type PaletteId = "blue-light" | "crimson" | "navy" | "green";

export type Palette = {
  id: PaletteId;
  label: string;
  /** Bright-background variant (reference 1). */
  light: boolean;
  /** Scene clear colour. */
  background: string;
  /** Soft glow behind the eye. */
  backgroundGlow: string;
  /** Eyelid / lash particle cloud. */
  particle: string;
  /** Opaque base of the iris disc (sits behind all the additive detail). */
  irisBase: string;
  /** Shaded surface colour of the eyeball / lids mesh. */
  skin: string;
  /** HUD rings, iris streaks. */
  primary: string;
  /** Hottest highlights (core, bright arcs). */
  primaryBright: string;
  /** Accent hot-spots and lens flares. */
  secondary: string;
  /** SVG overlay lines and text. */
  hud: string;
  /** Vignette colour for the DOM overlay. */
  vignette: string;
  bloomStrength: number;
  bloomThreshold: number;
  exposure: number;
  /** Multiplier for the particle cloud brightness. */
  particleIntensity: number;
};

export const PALETTES: Record<PaletteId, Palette> = {
  "blue-light": {
    id: "blue-light",
    label: "Blue (light)",
    light: true,
    background: "#2f63c8",
    backgroundGlow: "#3f78d8",
    particle: "#e6f4ff",
    irisBase: "#1a4dc0",
    skin: "#2b5fcc",
    primary: "#0f5cff",
    primaryBright: "#dff0ff",
    secondary: "#ffb26b",
    hud: "#ffffff",
    vignette: "rgba(70, 130, 230, 0.5)",
    bloomStrength: 0.35,
    bloomThreshold: 0.7,
    exposure: 0.85,
    particleIntensity: 0.08,
  },
  crimson: {
    id: "crimson",
    label: "Crimson",
    light: false,
    background: "#2a0912",
    backgroundGlow: "#3d0e1c",
    particle: "#ff8fa8",
    irisBase: "#23060f",
    skin: "#4a1226",
    primary: "#ff3f6f",
    primaryBright: "#ffe9f0",
    secondary: "#ffd3de",
    hud: "#ffb8c9",
    vignette: "rgba(18, 3, 8, 0.8)",
    bloomStrength: 0.7,
    bloomThreshold: 0.35,
    exposure: 0.92,
    particleIntensity: 0.06,
  },
  navy: {
    id: "navy",
    label: "Navy",
    light: false,
    background: "#071a3c",
    backgroundGlow: "#0c2856",
    particle: "#7fb0ff",
    irisBase: "#061a3d",
    skin: "#0f2f66",
    primary: "#2a8dff",
    primaryBright: "#e2f3ff",
    secondary: "#ff9a3c",
    hud: "#9fcbff",
    vignette: "rgba(2, 8, 24, 0.8)",
    bloomStrength: 0.7,
    bloomThreshold: 0.35,
    exposure: 0.92,
    particleIntensity: 0.06,
  },
  green: {
    id: "green",
    label: "Green",
    light: false,
    background: "#052a16",
    backgroundGlow: "#083a20",
    particle: "#8cf5bd",
    irisBase: "#052a14",
    skin: "#0b4a28",
    primary: "#27e070",
    primaryBright: "#e9fff1",
    secondary: "#dfffe6",
    hud: "#a8f0c2",
    vignette: "rgba(2, 16, 8, 0.8)",
    bloomStrength: 0.7,
    bloomThreshold: 0.35,
    exposure: 0.92,
    particleIntensity: 0.06,
  },
};

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];
