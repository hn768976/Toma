export type Palette = {
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  latticeLine: string;
  blob: string;
  whiteout: string;
  atomCore: string;
  atomInner: string;
  atomMid: string;
  atomRim: string;
  atomEdge: string;
  lensIn: string;
  lensEdge: string;
  caustic: string;
  shellTop: string;
  outline: string;
  label: string;
  neckEdge: string;
  neckCenter: string;
  neckCore: string;
};

/** Sampled from the reference footage (pale sky-blue lab look). */
export const HYDROGEN_BLUE: Palette = {
  bgTop: "#d6eef7",
  bgMid: "#e0f2f9",
  bgBottom: "#dcf0f8",
  latticeLine: "rgba(118,138,150,0.48)",
  blob: "rgba(104,190,232,0.36)",
  whiteout: "#f4fcff",
  atomCore: "#a6e0f7",
  atomInner: "#78c9f0",
  atomMid: "#49a9e2",
  atomRim: "#2f8ccd",
  atomEdge: "#2373b3",
  lensIn: "rgba(160,224,250,0.32)",
  lensEdge: "rgba(64,150,214,0.55)",
  caustic: "rgba(205,246,255,0.75)",
  shellTop: "rgba(22,80,140,0.28)",
  outline: "rgba(20,78,132,0.45)",
  label: "#132a48",
  neckEdge: "#1f6fb5",
  neckCenter: "#4aa6e0",
  neckCore: "rgba(38,72,108,0.75)",
};
