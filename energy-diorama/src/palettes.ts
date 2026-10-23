export type Palette = {
  background: string;
  platform: string;
  cable: string;
  panelCell: string;
  panelLine: string;
  panelFrame: string;
  turbine: string;
  controller: string;
  ledOff: string;
  ledOn: string;
  batterySlab: string;
  screen: string;
  icon: string;
  building: string;
  window: string;
  windowLit: string;
  buildingGlow: string;
  bulbGlass: string;
  bulbOn: string;
  bulbFlash: string;
  bulbBase: string;
  glowLight: string;
  sky: string;
  ground: string;
  ambient: number;
  keyLight: number;
  glowStrength: number;
  // Colour the lit side of the building and the board take on when the bulb is on.
  litSurface: string;
  litDecalOpacity: number;
};

// Version 1: soft pastel pink, sampled from the reference footage.
export const PINK: Palette = {
  background: "#feaece",
  platform: "#ff9dc5",
  cable: "#f27fab",
  panelCell: "#22a0dc",
  panelLine: "#e9f6ff",
  panelFrame: "#ff9fc6",
  turbine: "#ffffff",
  controller: "#ff9dc4",
  ledOff: "#24452a",
  ledOn: "#86f07a",
  batterySlab: "#ff98c0",
  screen: "#4d4d4d",
  icon: "#ffffff",
  building: "#ff9ec2",
  window: "#fff4f7",
  windowLit: "#fffbd0",
  buildingGlow: "#ffe600",
  bulbGlass: "#ffc6f6",
  bulbOn: "#ffef00",
  bulbFlash: "#ffffff",
  bulbBase: "#ff8696",
  glowLight: "#ffd000",
  sky: "#ffffff",
  ground: "#ff9cc6",
  ambient: 2.5,
  keyLight: 0.6,
  glowStrength: 1,
  litSurface: "#fff39a",
  litDecalOpacity: 0.95,
};

// Version 2: the same diorama re-lit as a night scene in deep indigo/teal,
// so the switch-on moment reads as warm light in the dark.
export const NIGHT: Palette = {
  background: "#151a3d",
  platform: "#222a5c",
  cable: "#33417f",
  panelCell: "#1fc8e8",
  panelLine: "#bff6ff",
  panelFrame: "#2b3570",
  turbine: "#dfe6ff",
  controller: "#2c3670",
  ledOff: "#16301f",
  ledOn: "#5dff8c",
  batterySlab: "#2b3570",
  screen: "#0c1028",
  icon: "#8ff3ff",
  building: "#2f3a78",
  window: "#4a5699",
  windowLit: "#ffe9a0",
  buildingGlow: "#ffb84d",
  bulbGlass: "#7b86d6",
  bulbOn: "#ffd23a",
  bulbFlash: "#fff8e0",
  bulbBase: "#5a64b0",
  glowLight: "#ffb347",
  sky: "#b8c4ff",
  ground: "#1a2050",
  ambient: 1.25,
  keyLight: 0.9,
  glowStrength: 1.8,
  litSurface: "#ffb65c",
  litDecalOpacity: 0.6,
};
