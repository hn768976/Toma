// Determinism (verify-loop step 4).
//
// Remotion renders frames out of order across several threads, so every value
// on screen has to be a pure function of useCurrentFrame(). The test: render
// frame 150 on its own from a cold start, render a sequential range that
// contains frame 150, and compare. They must be identical.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { readPNG, diff } from "./png.mjs";

const OUT = "out/verify/determinism";
mkdirSync(OUT, { recursive: true });

const scale = process.argv[3] ?? "0.25";
const id = process.argv[2] ?? "FallingPills-BlueCapsule";
const FRAME = 150;

console.log(`${id}: frame ${FRAME} alone vs. the same frame from a sequential range`);

execFileSync(
  "npx",
  ["remotion", "still", id, `${OUT}/alone.png`, `--frame=${FRAME}`, `--scale=${scale}`, "--timeout=300000", "--log=error"],
  { stdio: ["ignore", "ignore", "inherit"] },
);

execFileSync(
  "npx",
  [
    "remotion", "render", id, `${OUT}/seq`,
    "--sequence", `--frames=${FRAME - 3}-${FRAME + 3}`,
    `--scale=${scale}`, "--image-format=png", "--timeout=300000", "--log=error",
    "--concurrency=4",
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

// Remotion's sequence filenames are zero-padded to the composition's frame
// count, so the width depends on the composition. Match on the number rather
// than assuming a padding.
const files = readdirSync(`${OUT}/seq`).filter((f) => f.endsWith(".png"));
const match = files.find((f) => Number(f.replace(/\D/g, "")) === FRAME);
if (!match) {
  console.error(`No frame ${FRAME} among the sequence output: ${files.join(", ")}`);
  process.exit(1);
}
renameSync(`${OUT}/seq/${match}`, `${OUT}/sequential.png`);

const d = diff(readPNG(`${OUT}/alone.png`), readPNG(`${OUT}/sequential.png`));
const ok = d.max === 0;
console.log(
  `${ok ? "PASS" : "FAIL"}  maxDiff=${d.max} meanDiff=${d.mean.toFixed(4)}` +
    (ok ? "" : ` worstPixel=${d.worst.join(",")}`),
);
process.exit(ok ? 0 : 1);
