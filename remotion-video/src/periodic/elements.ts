/**
 * All 118 elements with the data the animation needs: symbol, atomic number,
 * name, group, period and category.
 *
 * `group` is null for the 28 f-block elements that live in the two detached
 * rows below the main table (Ce-Lu and Th-Lr). La (57) and Ac (89) keep a real
 * group because they sit in the main block at period 6/7, group 3.
 */

export type ElementCategory =
  | "alkali metal"
  | "alkaline earth"
  | "transition metal"
  | "post-transition metal"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble gas"
  | "lanthanide"
  | "actinide";

export type PeriodicElement = {
  atomicNumber: number;
  symbol: string;
  name: string;
  /** 1-18, or null for the detached f-block rows. */
  group: number | null;
  period: number;
  category: ElementCategory;
};

/** [atomicNumber, symbol, name, group, period, category] */
const RAW: [number, string, string, number | null, number, ElementCategory][] = [
  [1, "H", "Hydrogen", 1, 1, "nonmetal"],
  [2, "He", "Helium", 18, 1, "noble gas"],

  [3, "Li", "Lithium", 1, 2, "alkali metal"],
  [4, "Be", "Beryllium", 2, 2, "alkaline earth"],
  [5, "B", "Boron", 13, 2, "metalloid"],
  [6, "C", "Carbon", 14, 2, "nonmetal"],
  [7, "N", "Nitrogen", 15, 2, "nonmetal"],
  [8, "O", "Oxygen", 16, 2, "nonmetal"],
  [9, "F", "Fluorine", 17, 2, "halogen"],
  [10, "Ne", "Neon", 18, 2, "noble gas"],

  [11, "Na", "Sodium", 1, 3, "alkali metal"],
  [12, "Mg", "Magnesium", 2, 3, "alkaline earth"],
  [13, "Al", "Aluminium", 13, 3, "post-transition metal"],
  [14, "Si", "Silicon", 14, 3, "metalloid"],
  [15, "P", "Phosphorus", 15, 3, "nonmetal"],
  [16, "S", "Sulfur", 16, 3, "nonmetal"],
  [17, "Cl", "Chlorine", 17, 3, "halogen"],
  [18, "Ar", "Argon", 18, 3, "noble gas"],

  [19, "K", "Potassium", 1, 4, "alkali metal"],
  [20, "Ca", "Calcium", 2, 4, "alkaline earth"],
  [21, "Sc", "Scandium", 3, 4, "transition metal"],
  [22, "Ti", "Titanium", 4, 4, "transition metal"],
  [23, "V", "Vanadium", 5, 4, "transition metal"],
  [24, "Cr", "Chromium", 6, 4, "transition metal"],
  [25, "Mn", "Manganese", 7, 4, "transition metal"],
  [26, "Fe", "Iron", 8, 4, "transition metal"],
  [27, "Co", "Cobalt", 9, 4, "transition metal"],
  [28, "Ni", "Nickel", 10, 4, "transition metal"],
  [29, "Cu", "Copper", 11, 4, "transition metal"],
  [30, "Zn", "Zinc", 12, 4, "transition metal"],
  [31, "Ga", "Gallium", 13, 4, "post-transition metal"],
  [32, "Ge", "Germanium", 14, 4, "metalloid"],
  [33, "As", "Arsenic", 15, 4, "metalloid"],
  [34, "Se", "Selenium", 16, 4, "nonmetal"],
  [35, "Br", "Bromine", 17, 4, "halogen"],
  [36, "Kr", "Krypton", 18, 4, "noble gas"],

  [37, "Rb", "Rubidium", 1, 5, "alkali metal"],
  [38, "Sr", "Strontium", 2, 5, "alkaline earth"],
  [39, "Y", "Yttrium", 3, 5, "transition metal"],
  [40, "Zr", "Zirconium", 4, 5, "transition metal"],
  [41, "Nb", "Niobium", 5, 5, "transition metal"],
  [42, "Mo", "Molybdenum", 6, 5, "transition metal"],
  [43, "Tc", "Technetium", 7, 5, "transition metal"],
  [44, "Ru", "Ruthenium", 8, 5, "transition metal"],
  [45, "Rh", "Rhodium", 9, 5, "transition metal"],
  [46, "Pd", "Palladium", 10, 5, "transition metal"],
  [47, "Ag", "Silver", 11, 5, "transition metal"],
  [48, "Cd", "Cadmium", 12, 5, "transition metal"],
  [49, "In", "Indium", 13, 5, "post-transition metal"],
  [50, "Sn", "Tin", 14, 5, "post-transition metal"],
  [51, "Sb", "Antimony", 15, 5, "metalloid"],
  [52, "Te", "Tellurium", 16, 5, "metalloid"],
  [53, "I", "Iodine", 17, 5, "halogen"],
  [54, "Xe", "Xenon", 18, 5, "noble gas"],

  [55, "Cs", "Caesium", 1, 6, "alkali metal"],
  [56, "Ba", "Barium", 2, 6, "alkaline earth"],
  [57, "La", "Lanthanum", 3, 6, "lanthanide"],
  [58, "Ce", "Cerium", null, 6, "lanthanide"],
  [59, "Pr", "Praseodymium", null, 6, "lanthanide"],
  [60, "Nd", "Neodymium", null, 6, "lanthanide"],
  [61, "Pm", "Promethium", null, 6, "lanthanide"],
  [62, "Sm", "Samarium", null, 6, "lanthanide"],
  [63, "Eu", "Europium", null, 6, "lanthanide"],
  [64, "Gd", "Gadolinium", null, 6, "lanthanide"],
  [65, "Tb", "Terbium", null, 6, "lanthanide"],
  [66, "Dy", "Dysprosium", null, 6, "lanthanide"],
  [67, "Ho", "Holmium", null, 6, "lanthanide"],
  [68, "Er", "Erbium", null, 6, "lanthanide"],
  [69, "Tm", "Thulium", null, 6, "lanthanide"],
  [70, "Yb", "Ytterbium", null, 6, "lanthanide"],
  [71, "Lu", "Lutetium", null, 6, "lanthanide"],
  [72, "Hf", "Hafnium", 4, 6, "transition metal"],
  [73, "Ta", "Tantalum", 5, 6, "transition metal"],
  [74, "W", "Tungsten", 6, 6, "transition metal"],
  [75, "Re", "Rhenium", 7, 6, "transition metal"],
  [76, "Os", "Osmium", 8, 6, "transition metal"],
  [77, "Ir", "Iridium", 9, 6, "transition metal"],
  [78, "Pt", "Platinum", 10, 6, "transition metal"],
  [79, "Au", "Gold", 11, 6, "transition metal"],
  [80, "Hg", "Mercury", 12, 6, "transition metal"],
  [81, "Tl", "Thallium", 13, 6, "post-transition metal"],
  [82, "Pb", "Lead", 14, 6, "post-transition metal"],
  [83, "Bi", "Bismuth", 15, 6, "post-transition metal"],
  [84, "Po", "Polonium", 16, 6, "post-transition metal"],
  [85, "At", "Astatine", 17, 6, "halogen"],
  [86, "Rn", "Radon", 18, 6, "noble gas"],

  [87, "Fr", "Francium", 1, 7, "alkali metal"],
  [88, "Ra", "Radium", 2, 7, "alkaline earth"],
  [89, "Ac", "Actinium", 3, 7, "actinide"],
  [90, "Th", "Thorium", null, 7, "actinide"],
  [91, "Pa", "Protactinium", null, 7, "actinide"],
  [92, "U", "Uranium", null, 7, "actinide"],
  [93, "Np", "Neptunium", null, 7, "actinide"],
  [94, "Pu", "Plutonium", null, 7, "actinide"],
  [95, "Am", "Americium", null, 7, "actinide"],
  [96, "Cm", "Curium", null, 7, "actinide"],
  [97, "Bk", "Berkelium", null, 7, "actinide"],
  [98, "Cf", "Californium", null, 7, "actinide"],
  [99, "Es", "Einsteinium", null, 7, "actinide"],
  [100, "Fm", "Fermium", null, 7, "actinide"],
  [101, "Md", "Mendelevium", null, 7, "actinide"],
  [102, "No", "Nobelium", null, 7, "actinide"],
  [103, "Lr", "Lawrencium", null, 7, "actinide"],
  [104, "Rf", "Rutherfordium", 4, 7, "transition metal"],
  [105, "Db", "Dubnium", 5, 7, "transition metal"],
  [106, "Sg", "Seaborgium", 6, 7, "transition metal"],
  [107, "Bh", "Bohrium", 7, 7, "transition metal"],
  [108, "Hs", "Hassium", 8, 7, "transition metal"],
  [109, "Mt", "Meitnerium", 9, 7, "transition metal"],
  [110, "Ds", "Darmstadtium", 10, 7, "transition metal"],
  [111, "Rg", "Roentgenium", 11, 7, "transition metal"],
  [112, "Cn", "Copernicium", 12, 7, "transition metal"],
  [113, "Nh", "Nihonium", 13, 7, "post-transition metal"],
  [114, "Fl", "Flerovium", 14, 7, "post-transition metal"],
  [115, "Mc", "Moscovium", 15, 7, "post-transition metal"],
  [116, "Lv", "Livermorium", 16, 7, "post-transition metal"],
  [117, "Ts", "Tennessine", 17, 7, "halogen"],
  [118, "Og", "Oganesson", 18, 7, "noble gas"],
];

export const ELEMENTS: PeriodicElement[] = RAW.map(
  ([atomicNumber, symbol, name, group, period, category]) => ({
    atomicNumber,
    symbol,
    name,
    group,
    period,
    category,
  }),
);

/** Cycle order used by the "categories" highlight pass. */
export const CATEGORY_ORDER: ElementCategory[] = [
  "alkali metal",
  "alkaline earth",
  "transition metal",
  "post-transition metal",
  "metalloid",
  "nonmetal",
  "halogen",
  "noble gas",
  "lanthanide",
  "actinide",
];
