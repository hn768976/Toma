import { guardShieldOutline, keyholeOutline } from "../paths";
import { HIGH_DENSITY, type Variant } from "./types";

/**
 * v2 "green": a guard shield — flat across a wide top with rounded
 * shoulders, straight sides converging into a long taper to a narrow tip.
 * Inside it sits the same keyhole at icon size, lit but never swept. Amber
 * accents, four busy columns, three circuits.
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
  glyph: {
    outline: guardShieldOutline,
    heightRatio: 0.45,
    integrity: "solid",
    inner: { outline: keyholeOutline, heightRatio: 0.15, offsetYRatio: -0.022 },
  },
  panelDensity: HIGH_DENSITY,
  panelBehaviour: "active",
  sweep: { mode: "smooth", circuits: 3 },
  glitch: false,
};
