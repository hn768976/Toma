// ContactSheet.png: every still at 640x360, tiled 7 x 5, labelled with its
// file name.
//
//   node scripts/contact-sheet.mjs [--in out/stills] [--out out/ContactSheet.png]
import sharp from "sharp";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const inDir = path.resolve(root, arg("in", "out/stills"));
const outFile = path.resolve(root, arg("out", "out/ContactSheet.png"));

const TW = 640;
const TH = 360;
const LABEL = 30;
const GAP = 16;
const COLS = 7;
const ROWS = 5;

const files = readdirSync(inDir)
  .filter((f) => /^WC_\d\d_.*\.png$/.test(f))
  .sort();
if (files.length > COLS * ROWS) throw new Error(`${files.length} stills do not fit ${COLS}x${ROWS}`);

const W = GAP + COLS * (TW + GAP);
const H = GAP + ROWS * (TH + LABEL + GAP);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const tiles = await Promise.all(
  files.map(async (f, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const left = GAP + col * (TW + GAP);
    const top = GAP + row * (TH + LABEL + GAP);
    const img = await sharp(path.join(inDir, f)).resize(TW, TH, { kernel: "lanczos3" }).png().toBuffer();
    const label = Buffer.from(
      `<svg width="${TW}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">` +
        `<text x="2" y="21" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" fill="#3a3a3a">${esc(f)}</text></svg>`,
    );
    return [
      { input: img, left, top },
      { input: label, left, top: top + TH + 2 },
    ];
  }),
);

await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
  .composite(tiles.flat())
  .png()
  .toFile(outFile);
console.log(`${path.relative(root, outFile)}: ${files.length} stills, ${W}x${H}`);
