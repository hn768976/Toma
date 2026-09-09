import { FONT_FAMILY } from "./load-fonts";

export type CardStyle = "neon" | "metallic";

/**
 * Card edge length as a fraction of frame height. Sized to match the reference
 * clips, which measure roughly 0.50 (neon) and 0.54 (metallic) of frame
 * height. Every content size below is a fraction of this, so changing these
 * two numbers rescales both cards completely and identically for all 118
 * elements.
 */
export const CARD_FRACTION: Record<CardStyle, number> = {
  neon: 0.5,
  metallic: 0.48,
};

/**
 * Every content size is a fraction of the card's edge length S, and the same
 * fractions are used for all 118 elements — nothing is shrunk per element.
 * The widest case the layout has to survive is a three-digit atomic number, a
 * two-letter symbol and a five-character mass (Mercury exercises all three).
 */
export const cardLayout = (S: number, style: CardStyle) => ({
  size: S,
  pad: S * 0.078,
  /** Atomic number and mass. Medium on the neon card, smaller on the metallic. */
  metaSize: style === "neon" ? S * 0.1 : S * 0.076,
  /** Dominant element: about half the card height. */
  symbolSize: S * 0.46,
  /**
   * Vertical centre of the symbol's cap-height block, from the top of the
   * card. With line-height 1, Inter's cap block is centred on the text box to
   * within half a percent, so centring the box centres the caps.
   */
  symbolCentre: S * 0.495,
  nameSize: style === "neon" ? S * 0.062 : S * 0.055,
  /**
   * Top of the name's text box. Clears the descender of a lowercase symbol
   * letter (Hg, Ag, Mg, Rg, Og) rather than only the flat-bottomed ones.
   */
  nameTop: S * 0.83,
  radius: style === "neon" ? S * 0.08 : 0,
});

/**
 * Alphabetic baseline of the symbol, from the top of the card — the SVG
 * equivalent of the DOM box placement above, so the metallic card sets its
 * symbol on exactly the same line as the neon card.
 */
export const symbolBaselineFromTop = (S: number, style: CardStyle): number => {
  const l = cardLayout(S, style);
  return l.symbolCentre + l.symbolSize * 0.364;
};

/** Inter Medium with tabular figures, so digits never re-flow between elements. */
export const numericFont = (size: number): React.CSSProperties => ({
  fontFamily: FONT_FAMILY,
  fontWeight: 500,
  fontSize: size,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum" 1',
  lineHeight: 1,
  whiteSpace: "nowrap",
});

export const symbolFont = (size: number, weight: 600 | 700): React.CSSProperties => ({
  fontFamily: FONT_FAMILY,
  fontWeight: weight,
  fontSize: size,
  lineHeight: 1,
  whiteSpace: "nowrap",
});

export const nameFont = (size: number): React.CSSProperties => ({
  fontFamily: FONT_FAMILY,
  fontWeight: 500,
  fontSize: size,
  letterSpacing: size * 0.22,
  // Rendered as an inline-block inside a text-align:center parent. CSS puts
  // letter-spacing after the final glyph too, which would push the word left
  // of centre; the negative right margin takes that trailing space back out
  // of the width used for centring.
  display: "inline-block",
  marginRight: -size * 0.22,
  lineHeight: 1,
  whiteSpace: "nowrap",
  textTransform: "uppercase",
});
