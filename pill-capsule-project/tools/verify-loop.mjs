// Loop closure (verify-loop step 3).
//
// A 300-frame loop means frame 300 equals frame 0, not frame 299 — but a
// 300-frame composition has no frame 300. Each "-loopcheck" composition runs
// one frame longer while the motion still uses the row's own loopFrames, so
// its last frame should be pixel-identical to its frame 0.
//
// Usage: node tools/verify-loop.mjs [scale]
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { readPNG, diff } from "./png.mjs";

const scale = process.argv[2] ?? "0.25";
const OUT = "out/verify";
mkdirSync(OUT, { recursive: true });

const CASES = [
  { id: "SinglePill-CapsuleGrey-loopcheck", loop: 300 },
  { id: "SinglePill-TabletBlue-loopcheck", loop: 300 },
  { id: "SinglePill-BlackMatte-loopcheck", loop: 300 },
  { id: "FallingPills-MixedWhite-loopcheck", loop: 450 },
  { id: "FallingPills-BlueCapsule-loopcheck", loop: 450 },
  { id: "FallingPills-RedCapsule-loopcheck", loop: 450 },
];

const still = (id, frame, file) =>
  execFileSync(
    "npx",
    ["remotion", "still", id, file, `--frame=${frame}`, `--scale=${scale}`, "--timeout=300000", "--log=error"],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

let failures = 0;
for (const c of CASES) {
  const a = `${OUT}/${c.id}-first.png`;
  const b = `${OUT}/${c.id}-last.png`;
  still(c.id, 0, a);
  still(c.id, c.loop, b);
  const d = diff(readPNG(a), readPNG(b));
  const ok = d.max === 0;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.id.padEnd(38)} frame 0 vs ${String(c.loop).padStart(3)}  ` +
      `maxDiff=${d.max} meanDiff=${d.mean.toFixed(4)}` +
      (ok ? "" : ` worstPixel=${d.worst.join(",")}`),
  );
}
console.log(failures === 0 ? "\nAll loops close exactly." : `\n${failures} composition(s) do not close.`);
process.exit(failures === 0 ? 0 : 1);
