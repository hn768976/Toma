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
    number: 2,
    symbol: "He",
    name: "Helium",
    mass: "4.003",
    category: "noble gas",
  },
  {
    number: 3,
    symbol: "Li",
    name: "Lithium",
    mass: "6.941",
    category: "alkali metal",
  },
  {
    number: 6,
    symbol: "C",
    name: "Carbon",
    mass: "12.01",
    category: "nonmetal",
  },
  {
    number: 7,
    symbol: "N",
    name: "Nitrogen",
    mass: "14.01",
    category: "nonmetal",
  },
  {
    number: 8,
    symbol: "O",
    name: "Oxygen",
    mass: "16.00",
    category: "nonmetal",
  },
  {
    number: 9,
    symbol: "F",
    name: "Fluorine",
    mass: "19.00",
    category: "halogen",
  },
  {
    number: 10,
    symbol: "Ne",
    name: "Neon",
    mass: "20.18",
    category: "noble gas",
  },
  {
    number: 11,
    symbol: "Na",
    name: "Sodium",
    mass: "22.99",
    category: "alkali metal",
  },
  {
    number: 12,
    symbol: "Mg",
    name: "Magnesium",
    mass: "24.31",
    category: "alkaline earth metal",
  },
  {
    number: 13,
    symbol: "Al",
    name: "Aluminium",
    mass: "26.98",
    category: "post-transition metal",
  },
  {
    number: 14,
    symbol: "Si",
    name: "Silicon",
    mass: "28.09",
    category: "metalloid",
  },
  {
    number: 15,
    symbol: "P",
    name: "Phosphorus",
    mass: "30.97",
    category: "nonmetal",
  },
  {
    number: 16,
    symbol: "S",
    name: "Sulfur",
    mass: "32.06",
    category: "nonmetal",
  },
  {
    number: 17,
    symbol: "Cl",
    name: "Chlorine",
    mass: "35.45",
    category: "halogen",
  },
  {
    number: 18,
    symbol: "Ar",
    name: "Argon",
    mass: "39.95",
    category: "noble gas",
  },
  {
    number: 19,
    symbol: "K",
    name: "Potassium",
    mass: "39.10",
    category: "alkali metal",
  },
  {
    number: 20,
    symbol: "Ca",
    name: "Calcium",
    mass: "40.08",
    category: "alkaline earth metal",
  },
  {
    number: 22,
    symbol: "Ti",
    name: "Titanium",
    mass: "47.87",
    category: "transition metal",
  },
  {
    number: 24,
    symbol: "Cr",
    name: "Chromium",
    mass: "52.00",
    category: "transition metal",
  },
  {
    number: 26,
    symbol: "Fe",
    name: "Iron",
    mass: "55.85",
    category: "transition metal",
  },
  {
    number: 27,
    symbol: "Co",
    name: "Cobalt",
    mass: "58.93",
    category: "transition metal",
  },
  {
    number: 28,
    symbol: "Ni",
    name: "Nickel",
    mass: "58.69",
    category: "transition metal",
  },
  {
    number: 29,
    symbol: "Cu",
    name: "Copper",
    mass: "63.55",
    category: "transition metal",
  },
  {
    number: 30,
    symbol: "Zn",
    name: "Zinc",
    mass: "65.38",
    category: "transition metal",
  },
  {
    number: 47,
    symbol: "Ag",
    name: "Silver",
    mass: "107.9",
    category: "transition metal",
  },
  {
    number: 50,
    symbol: "Sn",
    name: "Tin",
    mass: "118.7",
    category: "post-transition metal",
  },
  {
    number: 53,
    symbol: "I",
    name: "Iodine",
    mass: "126.9",
    category: "halogen",
  },
  {
    number: 78,
    symbol: "Pt",
    name: "Platinum",
    mass: "195.1",
    category: "transition metal",
  },
  {
    number: 79,
    symbol: "Au",
    name: "Gold",
    mass: "197.0",
    category: "transition metal",
  },
  {
    number: 80,
    symbol: "Hg",
    name: "Mercury",
    mass: "200.6",
    category: "transition metal",
  },
  {
    number: 82,
    symbol: "Pb",
    name: "Lead",
    mass: "207.2",
    category: "post-transition metal",
  },
  {
    number: 92,
    symbol: "U",
    name: "Uranium",
    mass: "238.0",
    category: "actinide",
  },
];
