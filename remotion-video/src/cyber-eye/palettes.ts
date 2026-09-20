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
    background: "#2a5fc4",
    backgroundGlow: "#4d8de6",
    particle: "#e6f4ff",
    irisBase: "#1a4dc0",
    skin: "#1c5ae0",
    primary: "#0f5cff",
    primaryBright: "#dff0ff",
    secondary: "#ffb26b",
    hud: "#ffffff",
    vignette: "rgba(120, 180, 255, 0.45)",
    bloomStrength: 0.35,
    bloomThreshold: 0.7,
    exposure: 0.85,
    particleIntensity: 0.28,
  },
  crimson: {
    id: "crimson",
    label: "Crimson",
    light: false,
    background: "#120408",
    backgroundGlow: "#4a0d1e",
    particle: "#ff8fa8",
    irisBase: "#23060f",
    skin: "#b02a4e",
    primary: "#ff3f6f",
    primaryBright: "#ffe9f0",
    secondary: "#ffd3de",
    hud: "#ffb8c9",
    vignette: "rgba(10, 0, 4, 0.75)",
    bloomStrength: 0.7,
    bloomThreshold: 0.35,
    exposure: 0.92,
    particleIntensity: 0.24,
  },
  navy: {
    id: "navy",
    label: "Navy",
    light: false,
    background: "#02050f",
    backgroundGlow: "#0b2050",
    particle: "#7fb0ff",
    irisBase: "#061a3d",
    skin: "#1c62b8",
    primary: "#2a8dff",
    primaryBright: "#e2f3ff",
    secondary: "#ff9a3c",
    hud: "#9fcbff",
    vignette: "rgba(0, 2, 10, 0.75)",
    bloomStrength: 0.7,
    bloomThreshold: 0.35,
    exposure: 0.92,
    particleIntensity: 0.24,
  },
  green: {
    id: "green",
    label: "Green",
    light: false,
    background: "#020f08",
    backgroundGlow: "#0a3d22",
    particle: "#8cf5bd",
    irisBase: "#052a14",
    skin: "#1b9a4e",
    primary: "#27e070",
    primaryBright: "#e9fff1",
    secondary: "#dfffe6",
    hud: "#a8f0c2",
    vignette: "rgba(0, 8, 3, 0.75)",
    bloomStrength: 0.7,
    bloomThreshold: 0.35,
    exposure: 0.92,
    particleIntensity: 0.24,
  },
};

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];
