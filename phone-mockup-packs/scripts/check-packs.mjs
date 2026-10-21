// Validates data/packs.json: segments must tile each pack exactly, no gaps or
// overlaps. With --fix, recomputes every "start" from the lengths in order and
// updates durationInFrames to match.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../data/packs.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const fix = process.argv.includes("--fix");
let ok = true;

for (const pack of data.packs) {
  let cursor = 0;
  for (const seg of pack.segments) {
    if (seg.start !== cursor) {
      if (fix) seg.start = cursor;
      else {
        ok = false;
        console.log(`✗ ${pack.id} ${seg.move}: start ${seg.start}, expected ${cursor}`);
      }
    }
    if (!(seg.length > 0)) {
      ok = false;
      console.log(`✗ ${pack.id} ${seg.move}: length must be > 0`);
    }
    cursor += seg.length;
  }
  if (cursor !== pack.durationInFrames) {
    if (fix) {
      console.log(`• ${pack.id}: durationInFrames ${pack.durationInFrames} -> ${cursor}`);
      pack.durationInFrames = cursor;
    } else {
      ok = false;
      console.log(`✗ ${pack.id}: segments sum to ${cursor}, durationInFrames is ${pack.durationInFrames}`);
    }
  }
  console.log(`${pack.id}: ${pack.segments.length} segments, ${cursor} frames (${(cursor / data.fps).toFixed(2)}s)`);
}

if (fix) {
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("data/packs.json updated");
} else if (!ok) {
  process.exit(1);
} else {
  console.log("✓ all packs tile exactly");
}
