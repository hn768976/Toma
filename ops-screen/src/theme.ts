/**
 * The two palettes. V1 is the green/teal reference match, V2 the same
 * layout in cool blue-grey. Both keep the warning glyph warm amber so it
 * still reads as a warning rather than blending into the palette.
 */
export type Theme = {
  id: string;
  bg: string;
  bgDeep: string;
  grid: string;
  frame: string;
  frameBright: string;
  titleBarBg: string;
  windowBg: string;
  body: string;
  bodyDim: string;
  bright: string;
  codeBg: string;
  glow: string;
  warn: string;
  label: string;
  syntax: {
    comment: string;
    keyword: string;
    string: string;
    number: string;
    fn: string;
    punct: string;
    plain: string;
  };
};

export const GREEN: Theme = {
  id: "green",
  bg: "#0a1a14",
  bgDeep: "#061009",
  grid: "rgba(90, 154, 122, 0.12)",
  frame: "#1e3a2e",
  frameBright: "#2f5c47",
  titleBarBg: "#123024",
  windowBg: "rgba(46, 122, 92, 0.055)",
  body: "#5a9a7a",
  bodyDim: "#3d6b54",
  bright: "#8ae0b0",
  codeBg: "#050d0a",
  glow: "rgba(120, 220, 170, 0.16)",
  warn: "#d99a3c",
  label: "#2f6b4e",
  syntax: {
    comment: "#3f7d5f",
    keyword: "#63d6c0",
    string: "#d8a24a",
    number: "#c3e8a0",
    fn: "#a9edc8",
    punct: "#5f9c7e",
    plain: "#bfe8cf",
  },
};

export const BLUE: Theme = {
  id: "blue",
  bg: "#0a1220",
  bgDeep: "#060b14",
  grid: "rgba(90, 122, 154, 0.13)",
  frame: "#1e2e42",
  frameBright: "#33506f",
  titleBarBg: "#132234",
  windowBg: "rgba(58, 104, 156, 0.055)",
  body: "#5a7a9a",
  bodyDim: "#3f5b76",
  bright: "#8ab8e0",
  codeBg: "#050a12",
  glow: "rgba(120, 180, 235, 0.16)",
  warn: "#d99a3c",
  label: "#33587d",
  syntax: {
    comment: "#41637f",
    keyword: "#5fc8e8",
    string: "#d3a45c",
    number: "#a9cdf0",
    fn: "#cfe4f7",
    punct: "#5f7f9c",
    plain: "#d6e6f5",
  },
};
