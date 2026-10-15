// Verifies data/elements.csv. Exits non-zero on any failure.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const text = fs.readFileSync(path.join(root, "data", "elements.csv"), "utf8").trim();
const [head, ...lines] = text.split("\n");
const cols = head.split(",");
const split = (l) => {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur); return out;
};
const rows = lines.map((l) => Object.fromEntries(split(l).map((v, i) => [cols[i], v])));
const bySym = Object.fromEntries(rows.map((r) => [r.symbol, r]));

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails++; };

check(rows.length === 118, `118 rows (got ${rows.length})`);
check(rows.every((r, i) => Number(r.z) === i + 1), "Z runs 1..118 with no gaps");
const masses = { H: "1.008", C: "12.011", Ca: "40.078", Zn: "65.38", Au: "196.97", U: "238.03", Tc: "[98]", Og: "[294]" };
for (const [s, m] of Object.entries(masses)) check(bySym[s]?.mass === m, `${s} mass ${m} (got ${bySym[s]?.mass})`);
const names = { 111: ["Rg", "Roentgenium"], 112: ["Cn", "Copernicium"], 113: ["Nh", "Nihonium"], 114: ["Fl", "Flerovium"],
  115: ["Mc", "Moscovium"], 116: ["Lv", "Livermorium"], 117: ["Ts", "Tennessine"], 118: ["Og", "Oganesson"] };
for (const [z, [s, n]] of Object.entries(names)) {
  const r = rows[Number(z) - 1];
  check(r.symbol === s && r.name === n, `Z=${z} is ${s} ${n} (got ${r.symbol} ${r.name})`);
}
check(!rows.some((r) => /^Uu|^Ub/.test(r.symbol) || /^Un/.test(r.name)), "no placeholder (Uuu/Uub/...) names");
check(bySym.Al.name === "Aluminium" && bySym.Al.name_us === "Aluminum", "Aluminium (IUPAC) / Aluminum (US)");
check(bySym.Cs.name === "Caesium" && bySym.Cs.name_us === "Cesium", "Caesium (IUPAC) / Cesium (US)");

// Layout: every tile in the right row/column, checked against an independent
// source (PeriodicTableJSON xpos/ypos, where the f-block rows are ypos 9/10).
const ptj = JSON.parse(fs.readFileSync(path.join(root, "data", "sources", "PeriodicTableJSON.json"), "utf8")).elements;
const bad = rows.filter((r) => { const p = ptj[Number(r.z) - 1]; return Number(r.col) !== p.xpos || Number(r.row) !== p.ypos; });
check(bad.length === 0, `all 118 tiles at the same row/col as the reference layout${bad.length ? ": " + bad.map((r) => r.symbol).join(" ") : ""}`);
const at = (s, row, col) => check(Number(bySym[s].row) === row && Number(bySym[s].col) === col, `${s} at row ${row}, col ${col}`);
at("H", 1, 1); at("He", 1, 18); at("Fr", 7, 1); at("La", 9, 3); at("Ac", 10, 3); at("Og", 7, 18); at("Lu", 9, 17); at("Lr", 10, 17);
const cells = new Set(rows.map((r) => `${r.row},${r.col}`));
check(cells.size === 118, "no two elements share a cell");
check(!cells.has("6,3") && !cells.has("7,3"), "group 3 of periods 6–7 left empty on the main table");
check(rows.every((r) => r.shells.split("-").reduce((a, b) => a + Number(b), 0) === Number(r.z)), "electron shells sum to Z");
check(rows.every((r) => Number(r.period) === (Number(r.row) <= 7 ? Number(r.row) : Number(r.row) - 3)), "period matches row");

if (fails) { console.log(`\n${fails} check(s) FAILED`); process.exit(1); }
console.log("\nAll element data checks passed.");
