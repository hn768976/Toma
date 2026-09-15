// Renders every Molecular Dreams version.
//
//   node scripts/render-all.mjs              -> 1920x1080 into out/1080p
//   node scripts/render-all.mjs --uhd        -> 3840x2160 into out/4k
//
// Options: --gl=<angle|swangle|egl>  --concurrency=<n>  --crf=<n>  --only=V3,V7
//
// The 4K pass renders the exact same compositions at twice the resolution —
// see the "-4K" entries in src/Root.tsx. Expect it to take roughly four times
// as long, since the cost is almost entirely per-pixel.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const uhd = process.argv.includes("--uhd");
const gl = arg("gl", "swangle");
const concurrency = arg("concurrency", "4");
const crf = arg("crf", "16");
const only = arg("only", null);

// Read the ids straight out of the presets so this never drifts from the source.
const presets = readFileSync(join(root, "src/molecular/presets.ts"), "utf8");
let ids = [...presets.matchAll(/^\s{4}id: "([^"]+)"/gm)].map((m) => m[1]);

if (only) {
  const wanted = new Set(only.split(","));
  ids = ids.filter((id) => wanted.has(id) || wanted.has(id.split("-")[0]));
}

if (ids.length === 0) {
  throw new Error("No compositions matched");
}

const outDir = join(root, "out", uhd ? "4k" : "1080p");
mkdirSync(outDir, { recursive: true });

console.log(`Rendering ${ids.length} version(s) at ${uhd ? "3840x2160" : "1920x1080"}`);

let failed = 0;

for (const [i, id] of ids.entries()) {
  const composition = uhd ? `${id}-4K` : id;
  const output = join(outDir, `${composition}.mp4`);
  const started = Date.now();

  console.log(`\n[${i + 1}/${ids.length}] ${composition}`);

  const result = spawnSync(
    "npx",
    [
      "remotion", "render", composition, output,
      "--codec=h264",
      `--crf=${crf}`,
      // Lossless intermediates. The default JPEG frames visibly band on these
      // smooth pastel gradients — the whole frame is gradient.
      "--image-format=png",
      // Remotion 4 defaults to "default" (bt601, full range) and tags the file
      // yuvj420p. The references are bt709 limited range, which is also what an
      // NLE expects; without this, levels shift on import.
      "--color-space=bt709",
      // Video-only: no silent AAC track.
      "--muted",
      // The 512x256 PMREM build can exceed the 30s default on a loaded worker.
      "--timeout=180000",
      `--gl=${gl}`,
      `--concurrency=${concurrency}`,
      "--log=error",
    ],
    { cwd: root, stdio: "inherit" },
  );

  if (result.status !== 0) {
    failed += 1;
    console.error(`  FAILED (exit ${result.status})`);
  } else {
    console.log(`  done in ${Math.round((Date.now() - started) / 1000)}s -> ${output}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} render(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${ids.length} render(s) complete -> ${outDir}`);
