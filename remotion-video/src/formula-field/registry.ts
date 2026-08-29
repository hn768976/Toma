// How a composition's `variant` prop resolves to variant data.
//
// This is the one seam between the multi-version project and a single-version
// export: there, this module returns that project's only variant and the
// three-key lookup disappears entirely.

import type { Variant } from "./variant-types";
import { VARIANTS, type VariantKey } from "./variants";

export const getVariant = (key: VariantKey): Variant => VARIANTS[key];
export type { VariantKey };
