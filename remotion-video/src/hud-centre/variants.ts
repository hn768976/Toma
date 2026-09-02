import { PALETTE } from "./palette";

export type CentreType = "wifi" | "crypto" | "radar";

/**
 * The ENTIRE difference between the three versions.
 *
 * Three keys only: which centre form to draw, the one accent colour that
 * form and the segment ring share, and the ID label in the bottom-right
 * corner. Everything else — palette, layout, panel content, timing, effects —
 * is shared and lives outside this object.
 *
 * If you find yourself wanting to add a fourth key, the thing you are adding
 * probably belongs in the shared layer instead.
 */
export const VARIANTS = {
  wifi: {
    centre: "wifi",
    accent: PALETTE.elementCyan, // #3FD4E8
    id: "BC-344",
  },
  crypto: {
    centre: "crypto",
    accent: "#4FD4F5", // a marginally brighter cyan
    id: "BC-754",
  },
  radar: {
    centre: "radar",
    accent: "#4FE8C4", // a green-shifted cyan
    id: "BC-890",
  },
} as const satisfies Record<
  CentreType,
  { centre: CentreType; accent: string; id: string }
>;

export type VariantKey = keyof typeof VARIANTS;
