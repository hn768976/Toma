/**
 * Harvest every still for every composition at 6000x3375.
 *
 * The frames come from each composition's own data row, three apiece. On the
 * shrinking look they are spread across the collapse — full, half-collapsed,
 * fragments — so the three images are genuinely different rather than three
 * near-duplicates of the same moment.
 *
 *   node scripts/stills.mjs            # all nine
 *   node scripts/stills.mjs DarkFibre  # only ids containing "DarkFibre"
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

// 3840 * 1.5625 = 6000, so a composition defined at 4K stills out at 6000x3375.
const SCALE = 1.5625;
const OUT = "out/stills";

const source = readFileSync("src/fatcells/looks.ts", "utf8");
const rows = [...source.matchAll(/id:\s*"([^"]+)"[\s\S]*?file:\s*"([^"]+)"/g)].map(
  (m) => ({ id: m[1], file: m[2] }),
);
const frames = [...source.matchAll(/stills:\s*\[([0-9,\s]+)\]/g)].map((m) =>
  m[1].split(",").map((n) => Number(n.trim())),
);

const filter = process.argv[2];
mkdirSync(OUT, { recursive: true });

rows.forEach((row, i) => {
  if (filter && !row.id.includes(filter)) return;
  for (const frame of frames[i]) {
    const out = `${OUT}/${row.file}_f${String(frame).padStart(3, "0")}.png`;
    process.stdout.write(`${out} ... `);
    execFileSync(
      "npx",
      ["remotion", "still", row.id, out, `--frame=${frame}`, `--scale=${SCALE}`, "--log=error"],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    process.stdout.write("done\n");
  }
});
