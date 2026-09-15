// The two colourways. Everything the field draws pulls its colour from
// one of these, so a new variant is a new object here and nothing else.

export type Theme = {
  /** Background stops, centre outward. */
  bgInner: string;
  bgMid: string;
  bgOuter: string;
  /** Soft bloom sitting behind the field. */
  bloom: string;
  /** Grid lines: base and the occasional accented one. */
  line: string;
  lineHot: string;
  /** Node dots. */
  nodeDim: string;
  nodeMid: string;
  nodeHot: string;
  /** Numeric readouts. */
  textDim: string;
  textMid: string;
  textHot: string;
  /** Short dashes and barcode blocks. */
  dash: string;
  dashHot: string;
  /** Colour the glow halos are tinted with. */
  glow: string;
  /** Vertical light shafts. */
  shaft: string;
};

export const BLUE_THEME: Theme = {
  bgInner: "#15294F",
  bgMid: "#0A1430",
  bgOuter: "#050A1B",
  bloom: "rgba(46, 116, 226, 0.20)",
  line: "rgba(86, 152, 236, 0.5)",
  lineHot: "rgba(140, 192, 255, 0.78)",
  nodeDim: "#4A93E8",
  nodeMid: "#AED4FF",
  nodeHot: "#FFFFFF",
  textDim: "#3E85DC",
  textMid: "#5CA6FF",
  textHot: "#FFFFFF",
  dash: "#2E7FDE",
  dashHot: "#8CC4FF",
  glow: "rgba(96, 166, 255, 0.85)",
  shaft: "rgba(72, 142, 238, 0.10)",
};

// "Matrix terminal" green: near-black ground, bright terminal green.
export const GREEN_THEME: Theme = {
  bgInner: "#05190C",
  bgMid: "#030C06",
  bgOuter: "#010603",
  bloom: "rgba(18, 205, 92, 0.13)",
  line: "rgba(20, 222, 102, 0.44)",
  lineHot: "rgba(104, 255, 168, 0.72)",
  nodeDim: "#1CC55F",
  nodeMid: "#9BFFC6",
  nodeHot: "#FFFFFF",
  textDim: "#15BC57",
  textMid: "#00FF41",
  textHot: "#FFFFFF",
  dash: "#14B455",
  dashHot: "#6CFFA6",
  glow: "rgba(0, 255, 100, 0.80)",
  shaft: "rgba(14, 200, 88, 0.07)",
};

export const THEMES = { blue: BLUE_THEME, green: GREEN_THEME };
export type ThemeName = keyof typeof THEMES;
