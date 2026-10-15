// Builds data/elements.csv from the saved sources in data/sources/.
//
//   - ciaaw-abridged-and-oxidation.csv : CIAAW/IUPAC abridged standard atomic
//     weights (5 significant figures; [n] = mass number of the longest-lived
//     isotope for elements with no stable isotopes) + common oxidation states.
//   - PeriodicTableJSON.json : names, categories, blocks, electron
//     configurations and electron shells (fetched once and saved).
//   - pubchem-legacy-elements.csv : PubChem-format element table, used only
//     as a cross-check of symbols.
//
// Layout (row/col) is computed from Z here, not copied, and then cross-checked
// by scripts/check-elements.mjs.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = (f) => path.join(root, "data", "sources", f);

const parseCsv = (text) => {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    rows.push(out);
  }
  return rows;
};

const ciaaw = parseCsv(fs.readFileSync(src("ciaaw-abridged-and-oxidation.csv"), "utf8")).slice(1);
const ptj = JSON.parse(fs.readFileSync(src("PeriodicTableJSON.json"), "utf8")).elements;
const legacy = parseCsv(fs.readFileSync(src("pubchem-legacy-elements.csv"), "utf8")).slice(1);

const PERIOD_END = [2, 10, 18, 36, 54, 86, 118];
const periodOf = (z) => PERIOD_END.findIndex((e) => z <= e) + 1;

// Standard 18-column layout. Rows 1..7 = periods; row 8 is the visual gap;
// rows 9 and 10 hold the lanthanides (57–71) and actinides (89–103) starting
// under group 3. Group 3 of periods 6–7 stays empty on the main table.
const layoutOf = (z) => {
  const p = periodOf(z);
  if (z >= 57 && z <= 71) return { row: 9, col: 3 + (z - 57), group: z === 57 ? 3 : null };
  if (z >= 89 && z <= 103) return { row: 10, col: 3 + (z - 89), group: z === 89 ? 3 : null };
  if (p === 1) return { row: 1, col: z === 1 ? 1 : 18, group: z === 1 ? 1 : 18 };
  const start = [0, 0, 3, 11, 19, 37, 55, 87][p];
  const i = z - start; // 0-based index within period
  let col;
  if (p <= 3) col = i < 2 ? i + 1 : i + 11; // s-block then p-block
  else if (p <= 5) col = i + 1;
  else col = i < 2 ? i + 1 : i - 14 + 1; // skip the 15 f-block elements (incl. La/Ac)
  return { row: p, col, group: col };
};

// Names: current IUPAC names, IUPAC spelling by default. name_us is the US
// spelling (switch in src/config.ts).
const IUPAC_SPELLING = { Cesium: "Caesium", Aluminum: "Aluminium" };
const US_SPELLING = { Caesium: "Cesium", Aluminium: "Aluminum" };

// Electron configuration: tidy the source string (drop the "predicted" star,
// restore missing spaces such as "5d16s2") and derive the shells from it, so the
// shells always agree with the configuration shown.
const NOBLE = { He: "1s2", Ne: "[He] 2s2 2p6", Ar: "[Ne] 3s2 3p6", Kr: "[Ar] 3d10 4s2 4p6",
  Xe: "[Kr] 4d10 5s2 5p6", Rn: "[Xe] 4f14 5d10 6s2 6p6" };
const ORB = /(\d)([spdf])(\d{1,2}?)(?=\s|$|\d[spdf])/g;
// Predicted ground states for Ds and Rg follow the relativistic calculations
// (6d8 7s2, 6d9 7s2) that the source's own shell lists already use.
const CONFIG_OVERRIDE = { Ds: "[Rn] 5f14 6d8 7s2", Rg: "[Rn] 5f14 6d9 7s2" };
const tidyConfig = (c) => {
  const s = c.replace(/\*/g, "").trim();
  const core = (s.match(/^\[(\w+)\]/) || [])[0] ?? "";
  const orbs = [...s.slice(core.length).matchAll(ORB)].map((m) => m[1] + m[2] + m[3]);
  return [core, ...orbs].filter(Boolean).join(" ");
};
const shellsOf = (config) => {
  const counts = [];
  const add = (c) => {
    const core = c.match(/^\[(\w+)\]/);
    if (core) add(NOBLE[core[1]]);
    for (const m of c.slice(core ? core[0].length : 0).matchAll(ORB)) {
      const n = Number(m[1]);
      counts[n - 1] = (counts[n - 1] ?? 0) + Number(m[3]);
    }
  };
  add(config);
  return Array.from(counts, (v) => v ?? 0);
};

const rows = [];
for (const [zs, symbol, mass, oxidation] of ciaaw) {
  const z = Number(zs);
  const p = ptj.find((e) => e.number === z);
  if (!p) throw new Error(`no source row for Z=${z}`);
  if (p.symbol !== symbol) throw new Error(`symbol mismatch Z=${z}: ${p.symbol} vs ${symbol}`);
  const lg = legacy.find((r) => Number(r[0]) === z);
  if (!lg || lg[1].trim() !== symbol) throw new Error(`legacy symbol mismatch Z=${z}`);
  const name = IUPAC_SPELLING[p.name] ?? p.name;
  const nameUs = US_SPELLING[name] ?? name;
  const { row, col, group } = layoutOf(z);
  const config = CONFIG_OVERRIDE[symbol] ?? tidyConfig(p.electron_configuration_semantic);
  const shells = shellsOf(config);
  if (shells.reduce((a, b) => a + b, 0) !== z) throw new Error(`shells of ${symbol} do not sum to Z`);
  if (shells.join("-") !== p.shells.join("-"))
    console.log(`note: ${symbol} shells from configuration ${shells.join("-")} (source list ${p.shells.join("-")})`);
  rows.push({
    z,
    symbol,
    name,
    name_us: nameUs,
    mass,
    period: periodOf(z),
    group: group ?? "",
    row,
    col,
    category: p.category,
    block: p.block,
    electron_configuration: config,
    shells: shells.join("-"),
    oxidation_states: oxidation.trim(),
  });
}

const cols = Object.keys(rows[0]);
const esc = (v) => {
  const s = String(v);
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
fs.writeFileSync(path.join(root, "data", "elements.csv"), csv);
console.log(`wrote data/elements.csv (${rows.length} rows)`);
