#!/usr/bin/env node
// Assemble the hero stills into numbered contact sheets: 4 x 3 grid of
// 640x360 tiles, 16 px gaps, a caption under each tile, neutral grey.
// Usage: node scripts/contact-sheet.mjs --in=out/stills --out=out/sheets
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const dir = args.in ?? "out/stills";
const outDir = args.out ?? "out/sheets";
fs.mkdirSync(outDir, { recursive: true });
const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));

const TW = 640, TH = 360, GAP = 16, CAP = 40, COLS = 4, ROWS = 3, PER = COLS * ROWS;
const W = COLS * TW + (COLS + 1) * GAP;
const H = ROWS * (TH + CAP) + (ROWS + 1) * GAP;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

for (let sheet = 0; sheet * PER < index.length; sheet++) {
  const items = index.slice(sheet * PER, sheet * PER + PER);
  const layers = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const x = GAP + (i % COLS) * (TW + GAP);
    const y = GAP + Math.floor(i / COLS) * (TH + CAP + GAP);
    const tile = await sharp(path.join(dir, it.file)).resize(TW, TH, { kernel: "lanczos3" }).png().toBuffer();
    layers.push({ input: tile, left: x, top: y });
    const svg = `<svg width="${TW}" height="${CAP}" xmlns="http://www.w3.org/2000/svg">
      <text x="4" y="27" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#f2f2f2">${it.n}. ${esc(it.name)} (frame ${it.frame})</text></svg>`;
    layers.push({ input: Buffer.from(svg), left: x, top: y + TH });
  }
  const file = path.join(outDir, `PlanetSheet_${String(sheet + 1).padStart(2, "0")}.png`);
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 96, g: 96, b: 96 } } })
    .composite(layers).png().toFile(file);
  console.log(`${file}: ${items.length} stills`);
}
