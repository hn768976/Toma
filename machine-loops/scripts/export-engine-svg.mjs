// Writes docs/engine-parts.svg: the beam engine at rest (crank angle 0) as
// clean SVG, one <g id="..."> per named part, from the same model the video
// draws.   node scripts/export-engine-svg.mjs
import { writeFileSync } from "node:fs";
import { drawList, pose } from "../src/blueprint/engine.ts";

const W = { thick: 7, mid: 5, thin: 3.4, hair: 2.4 };
const dash = { hidden: "16 11", center: "46 12 7 12" };
const items = drawList(pose(0, 0));
let body = "";
for (const { part, xf } of items) {
  const t = `translate(${xf.x.toFixed(2)} ${xf.y.toFixed(2)}) rotate(${((xf.a * 180) / Math.PI).toFixed(3)})`;
  body += `  <g id="${part.name}" transform="${t}">\n`;
  for (const s of part.strokes) {
    const extra = s.s === "hidden" || s.s === "center" ? ` stroke-dasharray="${dash[s.s]}"` : s.s === "construct" ? ` stroke-opacity="0.8"` : "";
    body += `    <path d="${s.d}" stroke-width="${W[s.w]}"${extra}/>\n`;
  }
  body += "  </g>\n";
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3300 -2700 7000 4400" width="7000" height="4400">
<rect x="-3300" y="-2700" width="7000" height="4400" fill="#000"/>
<g transform="scale(1 -1) translate(0 -1000)" fill="none" stroke="#F2F2F2" stroke-linecap="round" stroke-linejoin="round">
${body}</g>
</svg>
`;
writeFileSync(new URL("../docs/engine-parts.svg", import.meta.url), svg);
console.log(`wrote docs/engine-parts.svg: ${items.length} named groups`);
