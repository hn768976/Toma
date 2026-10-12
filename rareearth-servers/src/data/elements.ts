// Standard values: atomic number, symbol, name, atomic mass (2 dp).
export type Element = { z: number; symbol: string; name: string; mass: string };

export const ELEMENTS: Element[] = [
  { z: 39, symbol: "Y", name: "Yttrium", mass: "88.91" },
  { z: 57, symbol: "La", name: "Lanthanum", mass: "138.91" },
  { z: 58, symbol: "Ce", name: "Cerium", mass: "140.12" },
  { z: 59, symbol: "Pr", name: "Praseodymium", mass: "140.91" },
  { z: 60, symbol: "Nd", name: "Neodymium", mass: "144.24" },
  { z: 62, symbol: "Sm", name: "Samarium", mass: "150.36" },
  { z: 63, symbol: "Eu", name: "Europium", mass: "151.96" },
  { z: 64, symbol: "Gd", name: "Gadolinium", mass: "157.25" },
  { z: 65, symbol: "Tb", name: "Terbium", mass: "158.93" },
  { z: 66, symbol: "Dy", name: "Dysprosium", mass: "162.50" },
  { z: 68, symbol: "Er", name: "Erbium", mass: "167.26" },
  { z: 70, symbol: "Yb", name: "Ytterbium", mass: "173.05" },
];

export const bySymbol = (s: string): Element => {
  const e = ELEMENTS.find((x) => x.symbol === s);
  if (!e) throw new Error(`Unknown element ${s}`);
  return e;
};
