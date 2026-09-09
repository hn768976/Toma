import type { Stat } from "./topics";

/**
 * Formats a counting value. Digit count must not change as the value climbs
 * beyond what the target itself implies, or the row reflows mid-count — which
 * is why the decimals are fixed by the stat rather than by the current value,
 * and why the type is set with tabular figures.
 */
export const formatValue = (stat: Stat, value: number): string => {
  const fixed = value.toFixed(stat.decimals);
  const [whole, frac] = fixed.split(".");
  const grouped = stat.thousands
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : whole;
  const body = frac === undefined ? grouped : `${grouped}.${frac}`;
  return `${stat.prefix ?? ""}${body}${stat.suffix ?? ""}`;
};

/** A delta reads as a loss only when it is explicitly signed negative. */
export const isNegativeDelta = (delta: string) => delta.trim().startsWith("-");
