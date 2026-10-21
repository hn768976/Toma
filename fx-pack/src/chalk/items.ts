import { DIAGRAMS, DiagramName } from "./diagrams";
import { FORMULAS } from "./content";
import { layoutFormula, Stroke, strokeLength, toCard } from "./strokes";

export type ChalkItem = { id: string; strokes: Stroke[]; lens: number[]; ink: number; w: number; h: number };

export const FORMULA_SIZE = 165; // font size in 4K px at scale 1

const finish = (id: string, strokes: Stroke[], w: number, h: number): ChalkItem => {
  const lens = strokes.map(strokeLength);
  return { id, strokes, lens, ink: lens.reduce((a, b) => a + b, 0), w, h };
};

let cache: Record<string, ChalkItem> | null = null;

/** Every formula and diagram, laid out once (4K px, top-left at 0,0). */
export const getItems = () => {
  if (cache) return cache;
  const out: Record<string, ChalkItem> = {};
  FORMULAS.forEach((f) => {
    const c = toCard(layoutFormula(f.tokens, FORMULA_SIZE));
    out[f.id] = finish(f.id, c.strokes, c.w, c.h);
  });
  (Object.keys(DIAGRAMS) as DiagramName[]).forEach((name, i) => {
    const d = DIAGRAMS[name](1000 + i * 97);
    out[name] = finish(name, d.strokes, d.w, d.h);
  });
  cache = out;
  return out;
};
