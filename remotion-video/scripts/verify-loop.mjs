/**
 * Verifies the seamless loop numerically.
 *
 * The animation closes if the element field at frame `durationInFrames` is
 * identical to the field at frame 0 — same positions, sizes, colours and
 * alphas, element for element. That is the whole reason the field is built as
 * a pattern repeated per ring cell (see `field.ts`), so it is worth asserting
 * rather than eyeballing.
 *
 * Also checks the two other periodic drivers: the synthetic spectrum and the
 * beat envelope.
 *
 * Run with: npm run verify-loop
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const out = mkdtempSync(join(tmpdir(), "radial-eq-loop-"));
try {
  // The modules under test are DOM-free, so they can simply be compiled to
  // CommonJS and required here.
  execFileSync(
    "npx",
    [
      "tsc",
      "src/radial-equalizer/records.ts",
      "--outDir",
      out,
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

  const require_ = createRequire(import.meta.url);
  const { buildRecords } = require_(join(out, "records.js"));
  const { spectrumAt, beatEnvelope } = require_(
    join(out, "spectrum.js"),
  );
  const { DURATION_IN_FRAMES, BASE_WIDTH, BASE_HEIGHT } = require_(
    join(out, "constants.js"),
  );

  const D = DURATION_IN_FRAMES;
  const failures = [];

  // 1. The element field.
  const opts = { width: BASE_WIDTH, height: BASE_HEIGHT, duration: D };
  const a = buildRecords({ ...opts, frame: 0 });
  const b = buildRecords({ ...opts, frame: D });
  if (a.length !== b.length) {
    failures.push(`element count ${a.length} at frame 0 vs ${b.length} at ${D}`);
  } else {
    const fields = ["x", "y", "angle", "w", "h", "alpha", "glow", "bucket"];
    // Records are sorted by bucket, so compare as multisets keyed on geometry.
    const norm = (r) =>
      fields
        .map((f) => (f === "angle" ? mod2pi(r[f]) : r[f]).toFixed(6))
        .join("|");
    const setA = a.map(norm).sort();
    const setB = b.map(norm).sort();
    let worst = 0;
    for (let i = 0; i < setA.length; i++) {
      if (setA[i] !== setB[i]) {
        worst++;
      }
    }
    if (worst > 0) {
      failures.push(
        `${worst}/${setA.length} elements differ between frame 0 and frame ${D}`,
      );
    }
  }

  // 2. The spectrum.
  const s0 = spectrumAt(0, D);
  const sD = spectrumAt(D, D);
  let maxDelta = 0;
  for (let i = 0; i < s0.length; i++) {
    maxDelta = Math.max(maxDelta, Math.abs(s0[i] - sD[i]));
  }
  if (maxDelta > 1e-9) {
    failures.push(`spectrum differs by ${maxDelta} at the loop point`);
  }

  // 3. The beat envelope.
  if (beatEnvelope(0) !== beatEnvelope(D)) {
    failures.push("beat envelope differs at the loop point");
  }

  if (failures.length > 0) {
    console.error("Loop verification FAILED:");
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
  console.log(
    `Loop verified: ${a.length} on-screen elements, spectrum and beat all ` +
      `identical at frame 0 and frame ${D}.`,
  );
} finally {
  rmSync(out, { recursive: true, force: true });
}

function mod2pi(v) {
  const t = v % (Math.PI * 2);
  return t < 0 ? t + Math.PI * 2 : t;
}
