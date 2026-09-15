// Per-version palettes, sampled from the reference clips.
//
// Eight versions sit in the blue/cyan family; V06 is the deliberate warm
// outlier (amber circuitry on teal), matching its reference.

import { VersionId } from "./versions";

export type Palette = {
  /** Deepest background value, used for the page and the fog colour. */
  background: string;
  /** Secondary background tint the vignette fades toward. */
  backgroundLift: string;
  /** Dominant structural colour: traces, grids, wireframes. */
  primary: string;
  /** Brighter accent for hot edges, rim light and pulses. */
  accent: string;
  /** Near-white core colour for the hottest emissive areas. */
  core: string;
  /** Colour of ambient particles and dust. */
  particle: string;
  /** Sparingly used contrast colour for readouts and highlights. */
  signal: string;
};

/** Hex string to a linear-ish [r,g,b] triple for use in shader uniforms. */
export const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const PALETTES: Record<VersionId, Palette> = {
  V01Halo: {
    background: "#020818",
    backgroundLift: "#06214d",
    primary: "#2f7fff",
    accent: "#69bcff",
    core: "#e8f5ff",
    particle: "#8fc6ff",
    signal: "#b8e2ff",
  },
  V02Projection: {
    background: "#01040f",
    backgroundLift: "#04165a",
    primary: "#1a6bff",
    accent: "#57b6ff",
    core: "#f0f8ff",
    particle: "#6aa8ff",
    signal: "#9fd5ff",
  },
  V03Fibers: {
    background: "#01050e",
    backgroundLift: "#04204f",
    primary: "#1e7bff",
    accent: "#63b4ff",
    core: "#f4faff",
    particle: "#79b8ff",
    signal: "#c8e6ff",
  },
  V04Pedestal: {
    background: "#040b1b",
    backgroundLift: "#0a2550",
    primary: "#4f9be8",
    accent: "#8cc8f5",
    core: "#f2f9ff",
    particle: "#9ccbf0",
    signal: "#d8ecff",
  },
  V05Flythrough: {
    background: "#020a1e",
    backgroundLift: "#052a6e",
    primary: "#2f8fff",
    accent: "#7ac4ff",
    core: "#eef7ff",
    particle: "#6fb4ff",
    signal: "#a9d8ff",
  },
  V06Amber: {
    background: "#02100e",
    backgroundLift: "#03191a",
    primary: "#ff4410",
    accent: "#ff6a1c",
    core: "#ff8c38",
    particle: "#17b8a4",
    signal: "#24d4be",
  },
  V07Hud: {
    background: "#010a1c",
    backgroundLift: "#032a63",
    primary: "#1b7ff0",
    accent: "#6fd0ff",
    core: "#eaf7ff",
    particle: "#5fa8f0",
    signal: "#ffb020",
  },
  V08Chevron: {
    background: "#020a26",
    backgroundLift: "#04225e",
    primary: "#1666e8",
    accent: "#5fb0ff",
    core: "#e9f4ff",
    particle: "#7ab4ff",
    signal: "#a6d4ff",
  },
  V09Assembly: {
    background: "#04090f",
    backgroundLift: "#0a1f2e",
    primary: "#7fb8cf",
    accent: "#bfe2f2",
    core: "#ffffff",
    particle: "#9fd0e4",
    signal: "#d8f0ff",
  },
};

export const paletteFor = (id: VersionId): Palette => PALETTES[id];
