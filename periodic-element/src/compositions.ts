import { ELEMENTS, type PeriodicElement } from "./data/elements";
import type { CardStyle } from "./layout";

/**
 * Composition ids are derived from the element list, so appending an element
 * in src/data/elements.ts is enough to get both of its compositions. Nothing
 * here needs editing for the remaining elements.
 */
export const STYLES: { style: CardStyle; prefix: string; suffix: string }[] = [
  { style: "neon", prefix: "V1", suffix: "ElementNeon" },
  { style: "metallic", prefix: "V2", suffix: "ElementMetallic" },
];

/**
 * Remotion composition ids allow letters, digits and hyphens only, so the id
 * uses a hyphen where the delivered file name uses an underscore.
 */
export const compositionId = (
  element: PeriodicElement,
  s: (typeof STYLES)[number],
): string => `${s.prefix}-${element.name}${s.suffix}`;

/** File stem for the delivered mp4/png, e.g. "V1_HydrogenElementNeon". */
export const outputName = (
  element: PeriodicElement,
  s: (typeof STYLES)[number],
): string => `${s.prefix}_${element.name}${s.suffix}`;

export const ALL_COMPOSITIONS = ELEMENTS.flatMap((element) =>
  STYLES.map((s) => ({
    id: compositionId(element, s),
    output: outputName(element, s),
    element,
    style: s.style,
  })),
);
