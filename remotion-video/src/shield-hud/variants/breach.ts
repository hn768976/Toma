import { shieldOutline } from "../paths";
import { HIGH_DENSITY, type Variant } from "./types";

/**
 * v3 "breach": the shield returns, but broken — gaps in the outline, frayed
 * ends, an interior crack, a sweep that stutters and stalls at every gap,
 * panels that freeze and corrupt, and periodic slice tears.
 */
export const BREACH: Variant = {
  palette: {
    backgroundDeep: "#140303",
    backgroundWash: "#4A0E10",
    glyphMid: "#FF3F4F",
    glyphPale: "#FFA8B0",
    glyphWhite: "#FFF0F0",
    accent: "#FF7A28",
    readoutWhite: "#FFE8E8",
    readoutDim: "#A86A6A",
    tickPale: "#D48A8A",
  },
  glyph: { outline: shieldOutline, heightRatio: 0.45, integrity: "fractured" },
  panelDensity: HIGH_DENSITY,
  panelBehaviour: "failing",
  sweep: { mode: "stutter", circuits: 2 },
  glitch: true,
};
