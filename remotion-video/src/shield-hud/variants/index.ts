import { BLUE } from "./blue";
import { GREEN } from "./green";
import { BREACH } from "./breach";
import type { Variant } from "./types";

export * from "./types";

export type VariantKey = "blue" | "green" | "breach";

/**
 * Every difference between the three versions lives in these three modules:
 * palette, centre glyph path, glyph integrity mode, panel density, panel
 * behaviour and sweep mode. Nothing else in the project carries a hex value
 * or a glyph shape.
 */
export const VARIANTS: Record<VariantKey, Variant> = {
  blue: BLUE,
  green: GREEN,
  breach: BREACH,
};
