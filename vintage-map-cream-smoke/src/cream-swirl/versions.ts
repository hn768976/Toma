// One data row per Cream Swirl version: base colour and inner glow (sRGB).
// To add a colour, add a row here and a <Composition> in Root.tsx.
export type CreamVersion = { id: string; base: string; glow: string };

export const CREAM_VERSIONS: Record<string, CreamVersion> = {
  Cream: { id: "Cream", base: "#ECEBEA", glow: "#F3DCC8" },
  Blush: { id: "Blush", base: "#F4E4E4", glow: "#F2BFC4" },
  Caramel: { id: "Caramel", base: "#E8D2B4", glow: "#C88A4E" },
};
