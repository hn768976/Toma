/**
 * The element list. This file is PURE DATA — adding one of the remaining
 * elements means appending an entry here and nothing else. No component,
 * composition or render command needs to change.
 *
 * Atomic numbers, symbols, names and standard atomic weights are factual and
 * in the public domain.
 *
 * MASS CONVENTION: four significant figures, stored pre-formatted as a string
 * so the convention lives in the data rather than in formatting code. Every
 * entry must follow it, so the set stays internally consistent:
 *
 *   1.008   6.941   200.6
 *
 * Four significant figures is at most five characters wide for every one of the
 * 118 elements, which is what lets a single type size serve all of them. For
 * elements with no stable isotope, write the mass number of the most stable
 * one in brackets, e.g. "[294]".
 */

export type ElementCategory =
  | "nonmetal"
  | "noble gas"
  | "alkali metal"
  | "alkaline earth metal"
  | "metalloid"
  | "halogen"
  | "post-transition metal"
  | "transition metal"
  | "lanthanide"
  | "actinide"
  | "unknown";

export type PeriodicElement = {
  /** Atomic number, 1-118. */
  number: number;
  /** One or two letters, e.g. "H", "Hg". */
  symbol: string;
  /** English name, title case. Rendered upper-cased on the card. */
  name: string;
  /** Standard atomic weight, four significant figures. See note above. */
  mass: string;
  /**
   * Not shown on either card style. Stored now because it costs nothing and
   * enables a category-coloured style variant later.
   */
  category: ElementCategory;
};

export const ELEMENTS: PeriodicElement[] = [
  {
    number: 1,
    symbol: "H",
    name: "Hydrogen",
    mass: "1.008",
    category: "nonmetal",
  },
  {
    number: 3,
    symbol: "Li",
    name: "Lithium",
    mass: "6.941",
    category: "alkali metal",
  },
  {
    number: 80,
    symbol: "Hg",
    name: "Mercury",
    mass: "200.6",
    category: "transition metal",
  },
];
