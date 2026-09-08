/**
 * The two versions.
 *
 * V1 "dark" is the conventional data-centre look: near-black floor, cool
 * rack panels, pinprick status LEDs.
 * V2 "light" reads as an explainer diagram — white floor, light grey racks,
 * soft shadows, muted LEDs.
 */

export type ThemeId = "dark" | "light";

export type Theme = {
  background: string;
  /** Fog distances, expressed as offsets from CAMERA_DISTANCE. */
  fogNear: number;
  fogFar: number;

  floorBase: string;
  floorAlt: string;
  ventDot: string;
  ventDotOpacity: number;

  chassis: string;
  chassisTop: string;
  front: string;
  division: string;
  interior: string;
  rail: string;

  ledColors: [string, string, string];
  /** Brightness of an LED that is currently "off" in its blink cycle. */
  ledOffLevel: number;
  ledScale: number;
  /** Additive sprite haloes around the LEDs — V1 only. */
  glow: boolean;
  glowOpacity: number;
  glowSize: number;

  tray: string;
  trayRail: string;
  hanger: string;
  cableColors: string[];
  cableAccent: string[];
  pulseColor: string;

  ceiling: string;
  ceilingOpacity: number;

  propBody: string;
  propPanel: string;
  propAccent: string;
  wall: string;
  spool: string;

  ambient: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  keyColor: string;
  key: number;
  fillColor: string;
  fill: number;

  contactShadow: number;
  /** Broad soft darkening under each row, standing in for ambient occlusion. */
  aisleAo: number;

  grain: number;
  vignette: number;
};

export const DARK: Theme = {
  background: "#070a0f",
  fogNear: 2,
  fogFar: 17,

  floorBase: "#0b0e13",
  floorAlt: "#11161e",
  ventDot: "#05070a",
  ventDotOpacity: 0.85,

  chassis: "#1a1f28",
  chassisTop: "#202734",
  front: "#242b36",
  division: "#0a0d12",
  interior: "#080b10",
  rail: "#2d3540",

  ledColors: ["#22e07a", "#22d3ee", "#f0a020"],
  ledOffLevel: 0.1,
  ledScale: 1,
  glow: true,
  glowOpacity: 0.5,
  glowSize: 0.085,

  tray: "#222933",
  trayRail: "#2b333e",
  hanger: "#1d2430",
  cableColors: ["#262c34", "#1f242c", "#2e353f", "#22272f"],
  cableAccent: ["#17395e", "#5f2723"],
  pulseColor: "#8ff0ff",

  ceiling: "#cfe6f2",
  ceilingOpacity: 0.42,

  propBody: "#191e27",
  propPanel: "#232a34",
  propAccent: "#2b6d8a",
  wall: "#12161d",
  spool: "#232830",

  ambient: 0.22,
  hemiSky: "#6d8dac",
  hemiGround: "#0d1116",
  hemi: 0.34,
  keyColor: "#d5e4f7",
  key: 1.15,
  fillColor: "#54749c",
  fill: 0.22,

  contactShadow: 0.4,
  aisleAo: 0.2,

  grain: 0.021,
  vignette: 0.5,
};

export const LIGHT: Theme = {
  background: "#fbfcfd",
  fogNear: 5,
  fogFar: 22,

  floorBase: "#f2f4f6",
  floorAlt: "#e8ebee",
  ventDot: "#b6bec6",
  ventDotOpacity: 0.75,

  chassis: "#d8dde2",
  chassisTop: "#e2e6ea",
  front: "#c0c7cf",
  division: "#a8b0b8",
  interior: "#aeb6be",
  rail: "#b7bfc7",

  ledColors: ["#3fbe78", "#3ab5cd", "#d69433"],
  ledOffLevel: 0.35,
  ledScale: 1.25,
  glow: false,
  glowOpacity: 0,
  glowSize: 0.07,

  tray: "#cbd2d8",
  trayRail: "#bcc4cc",
  hanger: "#c6cdd4",
  cableColors: ["#9aa3ac", "#a6aeb6", "#909aa4", "#9fa8b1"],
  cableAccent: ["#7f95ad", "#b08a8a"],
  pulseColor: "#4aa3c8",

  ceiling: "#ffffff",
  ceilingOpacity: 0.9,

  propBody: "#d2d8de",
  propPanel: "#c3cad2",
  propAccent: "#8fa9bc",
  wall: "#e4e8ec",
  spool: "#c8cfd6",

  ambient: 0.54,
  hemiSky: "#ffffff",
  hemiGround: "#c4cbd2",
  hemi: 0.28,
  keyColor: "#ffffff",
  key: 0.3,
  fillColor: "#dfe6ee",
  fill: 0.12,

  contactShadow: 0.3,
  aisleAo: 0.15,

  grain: 0.006,
  vignette: 0,
};

export const THEMES: Record<ThemeId, Theme> = { dark: DARK, light: LIGHT };
