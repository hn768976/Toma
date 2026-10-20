// Build-time art. Each machine module draws its static parts with the pinned
// anatomy kit and its turning parts flat, and this script writes the raw
// result as one anatomy-style SVG per machine (art/raw/<id>.svg). Parts are
// marked with data-part, the convention anatomy's own examples use for live
// parts; scripts/split-parts.mjs turns them into named groups for React.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { W, H } from "./art/common.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2);
const machines = ["overbalanced", "watermill", "flask", "magnet", "rollingball"].filter((id) => !only.length || only.includes(id));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

for (const id of machines) {
  const started = Date.now();
  const mod = await import(`./art/${id}.mjs`);
  const art = mod.build();
  const meta = { id: art.id, P: art.P, shadows: art.shadows, grid: art.grid, extra: art.extra ?? {}, parts: art.parts.map(({ name, kind, material, meta }) => ({ name, kind, material, ...meta })) };
  const body = art.parts.map((p) => `<g data-part="${p.name}" data-kind="${p.kind}">${p.svg}</g>`).join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg" viewBox="0 0 ${W} ${H}">\n<metadata id="pm-meta">${esc(JSON.stringify(meta))}</metadata>\n${body}\n</svg>\n`;
  const file = join(root, "art", "raw", `${id}.svg`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg);
  console.log(`${id}: ${art.parts.length} parts, ${(svg.length / 1024).toFixed(0)} KB raw, ${Date.now() - started} ms`);
}
