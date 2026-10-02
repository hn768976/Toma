/** One row per version. */
export type HexMosaicVersion = {
  id: string;
  tileDark: string; // darkest tile shade
  tileLight: string; // brightest tile shade
  flash: string; // flash / sparkle colour (white with a tint)
};

export const HEX_MOSAIC_VERSIONS: HexMosaicVersion[] = [
  { id: "HexMosaic-Blue", tileDark: "#1E5FB8", tileLight: "#4FA8F0", flash: "#DDF9FF" },
  { id: "HexMosaic-Gold", tileDark: "#B87A1E", tileLight: "#F0C04F", flash: "#FFF2D8" },
];
