// Composition id -> output file name, read straight from the data rows.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/compositions.ts", import.meta.url), "utf8");
const ids = [...src.matchAll(/id: "([^"]+)",\s*\n\s*outName: "([^"]+)"/g)];
export const ALL = ids.map(([, id, outName]) => ({ id, outName }));
