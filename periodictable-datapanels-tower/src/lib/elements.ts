import csvText from "../../data/elements.csv";
import { SPELLING } from "../config";

export type Element = {
  z: number;
  symbol: string;
  name: string;
  mass: string;
  period: number;
  group: number | null;
  row: number; // 1..7 main table, 9..10 f-block rows (8 is the gap)
  col: number; // 1..18
  category: string;
  categoryLabel: string; // short, title-cased family name for tiles
  shells: string; // "2-8-18-18-4"
  oxidation: string[]; // ["+2", "+4"]
};

const splitCsvLine = (l: string) => {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === '"' && l[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
};

// Map the source category to a standard family name. Elements whose
// chemistry is not established (category starts with "unknown") are labelled
// as such rather than guessed.
const categoryLabel = (c: string) => {
  if (c.startsWith("unknown")) return "Unknown Properties";
  if (c === "diatomic nonmetal" || c === "polyatomic nonmetal") return "Reactive Nonmetal";
  return c.replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
};

const parse = (): Element[] => {
  const [head, ...lines] = csvText.trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((line) => {
    const v = splitCsvLine(line);
    const g = (k: string) => v[cols.indexOf(k)] ?? "";
    return {
      z: Number(g("z")),
      symbol: g("symbol"),
      name: SPELLING === "US" ? g("name_us") : g("name"),
      mass: g("mass"),
      period: Number(g("period")),
      group: g("group") ? Number(g("group")) : null,
      row: Number(g("row")),
      col: Number(g("col")),
      category: g("category"),
      categoryLabel: categoryLabel(g("category")),
      shells: g("shells"),
      oxidation: g("oxidation_states") ? g("oxidation_states").split(" ") : [],
    };
  });
};

export const ELEMENTS: Element[] = parse();
if (ELEMENTS.length !== 118) throw new Error(`elements.csv: expected 118 rows, got ${ELEMENTS.length}`);

export const bySymbol = (s: string) => {
  const e = ELEMENTS.find((x) => x.symbol === s);
  if (!e) throw new Error(`unknown element ${s}`);
  return e;
};

// Table position in tile units: x = col-1, y = row-1 (down), with the f-block
// rows lowered by `fGap` tile heights below period 7.
export const tableXY = (e: Element, fGap: number) => {
  const x = e.col - 1;
  const y = e.row <= 7 ? e.row - 1 : 7 + fGap + (e.row - 9);
  return { x, y };
};
