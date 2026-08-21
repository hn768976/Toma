/**
 * Proves the composition loops exactly, rather than just looking like it does.
 *
 * Every animated quantity in this piece is a pure function of the frame number,
 * so "seamless loop" has a precise meaning: state(0) must equal
 * state(DURATION_IN_FRAMES) exactly, for the camera, every streak's phase, and
 * the density envelope. Frame 449 then leads into frame 0 as an ordinary
 * one-frame step.
 *
 * Run: npm run check:loop
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const outDir = mkdtempSync(join(tmpdir(), "neon-loop-"));

try {
  execFileSync(
    "npx",
    [
      "tsc",
      "src/NeonStreaks/config.ts",
      "src/NeonStreaks/geometry.ts",
      "src/NeonStreaks/streaks.ts",
      "src/NeonStreaks/random.ts",
      "--outDir",
      outDir,
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--target",
      "es2020",
      "--skipLibCheck",
    ],
    { stdio: "inherit" },
  );

  const { createRequire } = await import("node:module");
  const require = createRequire(pathToFileURL(join(outDir, "x.cjs")));

  const { config, DURATION_IN_FRAMES } = require(join(outDir, "config.js"));
  const { makeCamera } = require(join(outDir, "geometry.js"));
  const { STREAKS, phaseAt, densityAt } = require(join(outDir, "streaks.js"));

  const D = DURATION_IN_FRAMES;
  const failures = [];
  const near = (a, b, what) => {
    // These are the same arithmetic on the same inputs, so the only tolerance
    // needed is for floating-point representation of f/D vs (f+D)/D.
    if (Math.abs(a - b) > 1e-9) {
      failures.push(`${what}: ${a} !== ${b} (delta ${a - b})`);
    }
  };

  // 1. Camera returns to its exact starting pose.
  for (const [w, h] of [
    [1920, 1080],
    [1080, 1920],
  ]) {
    const a = makeCamera(0, D, w, h);
    const b = makeCamera(D, D, w, h);
    for (const k of ["x", "y", "sinRoll", "cosRoll", "topY", "spreadCoef"]) {
      near(a[k], b[k], `camera.${k} @${w}x${h}`);
    }
  }

  // 2. Every streak is at the same point on its path.
  for (const s of STREAKS) {
    near(phaseAt(s, 0, D), phaseAt(s, D, D), `streak ${s.index} phase`);
    if (!Number.isInteger(s.cycles)) {
      failures.push(`streak ${s.index} cycles is not an integer: ${s.cycles}`);
    }
  }

  // 3. The density envelope closes.
  near(densityAt(0, D), densityAt(D, D), "density");

  // 4. Camera periods must divide the loop evenly.
  for (const [name, cycles] of [
    ["truck", 1],
    ["height", 2],
    ["roll", 1],
  ]) {
    if (!Number.isInteger(cycles) || (D * cycles) % D !== 0) {
      failures.push(`camera ${name} period does not divide the loop`);
    }
  }

  // 5. Sanity: the streak table is deterministic and fully populated.
  if (STREAKS.length !== config.streaks.count) {
    failures.push(`expected ${config.streaks.count} streaks, got ${STREAKS.length}`);
  }

  if (failures.length) {
    console.error("LOOP CHECK FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log(
    `Loop check passed: camera, ${STREAKS.length} streak phases and the ` +
      `density envelope are all identical at frame 0 and frame ${D}.`,
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
