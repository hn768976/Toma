import { keyholeOutline } from "../paths";
import { HIGH_DENSITY, type Variant } from "./types";

/**
 * v2 "green": a keyhole rather than a shield — circle over a tapering slot,
 * with an interior concavity the shield lacks, so the sweep spends longer on
 * tight curvature. Amber accents, four busy columns, three circuits.
 */
export const GREEN: Variant = {
  palette: {
    backgroundDeep: "#021A0C",
    backgroundWash: "#064220",
    glyphMid: "#3FE87A",
    glyphPale: "#A8FFC4",
    glyphWhite: "#F0FFF4",
    accent: "#F5B02E",
    readoutWhite: "#E8FFEE",
    readoutDim: "#5FA878",
    tickPale: "#8AD4A0",
  },
  glyph: { outline: keyholeOutline, heightRatio: 0.38, integrity: "solid" },
  panelDensity: HIGH_DENSITY,
  panelBehaviour: "active",
  sweep: { mode: "smooth", circuits: 3 },
  glitch: false,
};
