// The three versions, assembled.
//
// Each variant's data lives in its own module so a version can be shipped on
// its own: a single-version project drops this file in favour of that
// variant's module, and nothing else changes.

import { VARIANT as CHEM } from "./variants/chem";
import { VARIANT as MATH } from "./variants/math";
import { VARIANT as PHYSICS } from "./variants/physics";
import type { Variant } from "./variant-types";

export type VariantKey = "chem" | "math" | "physics";

export const VARIANTS: Record<VariantKey, Variant> = {
  chem: CHEM,
  math: MATH,
  physics: PHYSICS,
};

export const VARIANT_KEYS: VariantKey[] = ["chem", "math", "physics"];
