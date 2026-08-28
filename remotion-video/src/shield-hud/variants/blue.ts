import { shieldOutline } from "../paths";
import { MEDIUM_DENSITY, type Variant } from "./types";

/**
 * v1 "blue": an intact heraldic shield in deep navy, with magenta accent
 * bars, three steady readout columns and a smooth two-circuit sweep.
 */
export const BLUE: Variant = {
  palette: {
    backgroundDeep: "#050B33",
    backgroundWash: "#0F1B5C",
    glyphMid: "#3F7FFF",
    glyphPale: "#A8C8FF",
    glyphWhite: "#F0F6FF",
    accent: "#D44FC4",
    readoutWhite: "#E8EEF8",
    readoutDim: "#6A7AB0",
    tickPale: "#8A9AD4",
  },
  glyph: { outline: shieldOutline, heightRatio: 0.45, integrity: "solid" },
  panelDensity: MEDIUM_DENSITY,
  panelBehaviour: "steady",
  sweep: { mode: "smooth", circuits: 2 },
  glitch: false,
};
