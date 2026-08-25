// Proves the composition loops: renders the seam frame (DURATION) and frame 0
// of CandleChartLoopCheck and compares them byte for byte.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const DURATION = 1000;
const OUT = "out/loop-check";
const extra = process.argv.slice(2);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const hashes = [0, DURATION].map((frame) => {
  const file = `${OUT}/frame-${frame}.png`;
  console.log(`rendering frame ${frame}...`);
  execFileSync(
    "npx",
    [
      "remotion",
      "still",
      "CandleChartLoopCheck",
      file,
      `--frame=${frame}`,
      "--log=error",
      ...extra,
    ],
    { stdio: "inherit" },
  );
  return createHash("sha256").update(readFileSync(file)).digest("hex");
});

console.log(`frame 0        ${hashes[0]}`);
console.log(`frame ${DURATION}     ${hashes[1]}`);

if (hashes[0] !== hashes[1]) {
  console.error(
    "\nFAIL: the seam frame differs from frame 0 — the loop is open.",
  );
  process.exit(1);
}
console.log(
  "\nOK: frame 0 and frame 1000 are pixel-identical. The loop closes.",
);
